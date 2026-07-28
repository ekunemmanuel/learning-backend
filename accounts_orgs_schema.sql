-- ============================================================================
-- Accounts, Organizations & RBAC — production schema
-- Target: PostgreSQL 14+
-- ============================================================================
-- Design summary
--   - A `user` is a single, standalone identity (one account per person).
--   - A user can hold zero or more `memberships`, each linking them to one
--     `organization` with exactly one `role`.
--   - Roles carry `permissions` through a join table, so both system-defined
--     roles (owner/admin/member/viewer) and custom per-org roles work the
--     same way.
--   - `invitations` are their own pending-state entity — no user row is
--     required to exist before an invite is sent. Accepting an invitation
--     either attaches to an existing user or creates one, then writes a
--     `membership` row.
--   - `projects` demonstrates polymorphic ownership: a resource belongs to
--     either a personal user account or an organization, never both.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email/slug

-- ----------------------------------------------------------------------------
-- Utility: auto-maintained updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- USERS (personal accounts)
-- ============================================================================
create table users (
  id                uuid primary key default gen_random_uuid(),
  email             citext unique not null,
  password_hash     text,                         -- null if SSO/OAuth-only
  name              text,
  avatar_url        text,
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz                   -- soft delete
);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- External identity links (GitHub, Google, SSO providers)
create table identities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  provider          text not null,                -- 'github', 'google', 'saml:acme'
  provider_user_id  text not null,
  provider_email    citext,
  created_at        timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index idx_identities_user on identities(user_id);

-- Active login sessions
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   text not null unique,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);

create index idx_sessions_user on sessions(user_id);
create index idx_sessions_active on sessions(user_id) where revoked_at is null;

-- Personal API tokens
create table api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  name          text not null,
  token_hash    text not null unique,
  scopes        text[] not null default '{}',
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz
);

create index idx_api_tokens_user on api_tokens(user_id);

-- Multi-Factor Authentication (MFA / 2FA)
create table user_mfa_methods (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  type              text not null check (type in ('totp', 'webauthn', 'sms')),
  name              text not null default 'Authenticator App',
  secret_encrypted  text,                         -- AES-256 encrypted TOTP secret
  is_verified       boolean not null default false,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, type)
);

create index idx_user_mfa_user on user_mfa_methods(user_id);

-- Single-use emergency recovery backup codes
create table user_mfa_backup_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  code_hash   text not null,                         -- hashed single-use backup code
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_mfa_backup_codes_user on user_mfa_backup_codes(user_id) where used_at is null;

-- Historical login attempt audit log & security lockout tracker
create table login_attempts (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null,
  user_id        uuid references users(id) on delete set null,
  ip_address     inet,
  user_agent     text,
  success        boolean not null,
  failure_reason text,                            -- 'invalid_password', 'mfa_failed', 'locked'
  attempted_at   timestamptz not null default now()
);

create index idx_login_attempts_email on login_attempts(email, attempted_at desc);
create index idx_login_attempts_ip on login_attempts(ip_address, attempted_at desc);

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          citext unique not null,
  billing_plan  text not null default 'free',
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

-- Auto-onboard users whose email domain matches a trusted domain
create table trusted_domains (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  domain           text not null,                 -- 'acme.com'
  default_role_id  uuid not null,                  -- fk added after roles table
  created_at       timestamptz not null default now(),
  unique (organization_id, domain)
);

-- ============================================================================
-- RBAC: roles & permissions
-- ============================================================================
-- Roles with organization_id = null are system-defined and shared by every
-- org (owner, admin, member, viewer). Roles with organization_id set are
-- custom roles scoped to that one org.
create table roles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id) on delete cascade,
  name             text not null,                  -- 'owner', 'billing_only', ...
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (organization_id, name)
);

alter table trusted_domains
  add constraint fk_trusted_domains_role
  foreign key (default_role_id) references roles(id);

create table permissions (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,               -- 'project.create', 'billing.manage'
  description  text
);

create table role_permissions (
  role_id        uuid not null references roles(id) on delete cascade,
  permission_id  uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ============================================================================
-- MEMBERSHIPS — the join between a personal account and an organization
-- ============================================================================
create table memberships (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  role_id          uuid not null references roles(id),
  status           text not null default 'active'
                     check (status in ('active', 'suspended')),
  invited_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, organization_id)
);

create trigger trg_memberships_updated_at
  before update on memberships
  for each row execute function set_updated_at();

create index idx_memberships_org on memberships(organization_id);
create index idx_memberships_user on memberships(user_id);

-- Pending invitations — exist independently of any user row
create table invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  email            citext not null,
  role_id          uuid not null references roles(id),
  token            text not null unique,
  invited_by       uuid references users(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at       timestamptz not null,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, email, status)
);

create index idx_invitations_org on invitations(organization_id);
create index idx_invitations_email on invitations(email);

-- ============================================================================
-- PROJECTS — example resource with polymorphic ownership
--   Owned by exactly one of: a personal user account, or an organization.
-- ============================================================================
create table projects (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  owner_user_id            uuid references users(id) on delete cascade,
  owner_organization_id    uuid references organizations(id) on delete cascade,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  constraint chk_projects_single_owner check (
    num_nonnulls(owner_user_id, owner_organization_id) = 1
  )
);

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

create index idx_projects_owner_user on projects(owner_user_id);
create index idx_projects_owner_org on projects(owner_organization_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
create table audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id) on delete set null,
  actor_user_id    uuid references users(id) on delete set null,
  action           text not null,                  -- 'membership.role_changed'
  target_type      text not null,                  -- 'membership', 'project', ...
  target_id        uuid,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index idx_audit_logs_org on audit_logs(organization_id, created_at desc);
create index idx_audit_logs_actor on audit_logs(actor_user_id);

-- ============================================================================
-- SEED: system-default roles + baseline permissions
-- ============================================================================
insert into roles (organization_id, name, is_system) values
  (null, 'owner',  true),
  (null, 'admin',  true),
  (null, 'member', true),
  (null, 'viewer', true);

insert into permissions (key, description) values
  ('org.manage_billing',   'Manage subscription and payment methods'),
  ('org.manage_members',   'Invite, remove, or change roles of members'),
  ('org.delete',           'Delete the organization'),
  ('project.create',       'Create new projects'),
  ('project.delete',       'Delete projects'),
  ('project.deploy',       'Deploy changes to a project'),
  ('project.view',         'View project contents');

-- Wire baseline permissions to system roles
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.organization_id is null and r.name = 'owner';               -- owner: all permissions

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.organization_id is null and r.name = 'admin'
  and p.key <> 'org.delete';                                        -- admin: all but delete org

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.organization_id is null and r.name = 'member'
  and p.key in ('project.create', 'project.deploy', 'project.view');

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.organization_id is null and r.name = 'viewer'
  and p.key = 'project.view';
