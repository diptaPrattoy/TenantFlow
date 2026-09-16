import { Router } from "express";
import {
  changeMemberRole,
  getOrganizationProfile,
  inviteMember,
  listOrganizationMembers,
  removeMember,
  updateOrganizationProfile,
} from "../controllers/organization.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { requireOrganizationContext } from "../middleware/tenant.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import {
  changeMemberRoleSchema,
  inviteMemberSchema,
  updateOrganizationSchema,
} from "../schemas/organization.schema.js";

export const organizationRouter = Router();

organizationRouter.use(authenticate, requireOrganizationContext);

organizationRouter.get(
  "/",
  allowRoles("ORG_ADMIN", "ORG_MEMBER"),
  getOrganizationProfile,
);

organizationRouter.patch(
  "/",
  allowRoles("ORG_ADMIN"),
  validateBody(updateOrganizationSchema),
  updateOrganizationProfile,
);

organizationRouter.get(
  "/members",
  allowRoles("ORG_ADMIN"),
  listOrganizationMembers,
);

organizationRouter.post(
  "/invitations",
  allowRoles("ORG_ADMIN"),
  validateBody(inviteMemberSchema),
  inviteMember,
);

organizationRouter.patch(
  "/members/:memberId/role",
  allowRoles("ORG_ADMIN"),
  validateBody(changeMemberRoleSchema),
  changeMemberRole,
);

organizationRouter.delete(
  "/members/:memberId",
  allowRoles("ORG_ADMIN"),
  removeMember,
);
