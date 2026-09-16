import { Router } from "express";
import {
  getOrganizationProfile,
  listOrganizationMembers,
} from "../controllers/organization.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { requireOrganizationContext } from "../middleware/tenant.middleware.js";

export const organizationRouter = Router();

organizationRouter.use(authenticate, requireOrganizationContext);

organizationRouter.get(
  "/",
  allowRoles("ORG_ADMIN", "ORG_MEMBER"),
  getOrganizationProfile,
);

organizationRouter.get(
  "/members",
  allowRoles("ORG_ADMIN"),
  listOrganizationMembers,
);
