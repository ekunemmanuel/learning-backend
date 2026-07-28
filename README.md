# Hono Starter Boilerplate

A production-ready backend boilerplate using Hono, Prisma, PostgreSQL, and Bun. This template provides a high-performance RESTful API with an interactive OpenAPI specification, out-of-the-box observability, and strict security rules.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev/)
- **Database ORM**: [Prisma](https://www.prisma.io/) with PostgreSQL
- **Schema Validation**: [Zod](https://zod.dev/) & `@hono/zod-openapi`
- **API Documentation**: [Scalar](https://scalar.com/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Logging & Observability**: Pino + [Better Stack (Logtail)](https://betterstack.com/)
- **Security**: Strict CORS, Secure Headers, and In-Memory Rate Limiting.

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) installed
- A PostgreSQL database running

### Installation

1. Install dependencies:
   ```bash
   bun install
   ```
   *(Note: The Prisma client is automatically generated during postinstall)*

2. Environment Setup:
   Copy `.env.example` to `.env` and fill in your details:
   - `DATABASE_URL`: PostgreSQL connection string.
   - `CORS_ORIGIN`: Allowed frontend URL.
   - `LOGTAIL_SOURCE_TOKEN`: Better Stack log token.

3. Database Setup:
   Run migrations to ensure your local DB is up to date:
   ```bash
   bun run db:migrate:dev
   ```

### Development

Start the development server with hot-reload:
```bash
bun run dev
```

Open [http://localhost:3000/reference](http://localhost:3000/reference) to view the interactive API documentation.

### Testing

Run the automated test suite:
```bash
bun test
```

## Endpoints

| Path                  | Description              |
| --------------------- | ------------------------ |
| GET /doc              | Open API Specification   |
| GET /reference        | Scalar API Documentation |
| GET /examples         | List all examples        |
| POST /examples        | Create an example        |
| GET /examples/{id}    | Get one example by id    |
| PATCH /examples/{id}  | Patch one example by id  |
| DELETE /examples/{id} | Delete one example by id |

## How to Build a Module

This API uses a modular architecture. Each feature is completely self-contained within its own folder inside `src/routes/`. 

To create a new module, you should follow the exact pattern based on the provided `examples` folder reference.

1. **`schema.ts`**: Define your Zod schemas for validation here. 
2. **`routes.ts`**: Define your OpenAPI route configurations using `@hono/zod-openapi`.
3. **`services.ts`**: Place all your business logic and database interactions here. 
4. **`handlers.ts`**: Write the actual Hono HTTP handlers.
5. **`index.ts`**: Tie the `routes.ts` and `handlers.ts` together into a Hono router and export it.
6. **`*.test.ts`**: Write Vitest tests for the module's endpoints ensuring all routes and validation rules are working properly.

### Registering your Module
Once you've built a new module folder (e.g., `src/routes/users`), you need to register it in `src/app.ts` so that Hono knows about it:
```typescript
import users from "./routes/users/index"; // Import your module's index

// ...
const routes = [
  examples,
  users, // Register your new module here
] as const;
```
