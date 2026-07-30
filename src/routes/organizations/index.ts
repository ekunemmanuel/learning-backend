import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";
import * as routes from "./routes";
import * as handlers from "./handlers";

const router = createRouter();

// Apply authentication middleware to all organization endpoints
router.use("/organizations/*", authMiddleware);
router.use("/organizations", authMiddleware);

const routerWithRoutes = router
  .openapi(routes.createOrganizationRoute, handlers.createOrganization)
  .openapi(routes.getUserOrganizationsRoute, handlers.getUserOrganizations)
  .openapi(routes.acceptInvitationRoute, handlers.acceptInvitation)
  .openapi(routes.getOrganizationRoute, handlers.getOrganization)
  .openapi(routes.updateOrganizationRoute, handlers.updateOrganization)
  .openapi(routes.deleteOrganizationRoute, handlers.deleteOrganization)
  .openapi(routes.getOrganizationMembersRoute, handlers.getOrganizationMembers)
  .openapi(routes.updateMemberRoleRoute, handlers.updateMemberRole)
  .openapi(routes.removeMemberRoute, handlers.removeMember)
  .openapi(routes.createInvitationRoute, handlers.createInvitation)
  .openapi(routes.getOrganizationInvitationsRoute, handlers.getOrganizationInvitations)
  .openapi(routes.cancelInvitationRoute, handlers.cancelInvitation);

export default routerWithRoutes;
