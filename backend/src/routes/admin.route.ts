import { Router } from "express";
import {
  adminStats,
  createPlan,
  listOrganizations,
  listPlans,
  listPlatformTransactions,
  organizationDetails,
  updateOrganizationStatus,
  updatePlan,
} from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import {
  createPlanSchema,
  organizationStatusSchema,
  updatePlanSchema,
} from "../schemas/admin.schema.js";

export const adminRouter = Router();

adminRouter.use(authenticate, allowRoles("PLATFORM_ADMIN"));

adminRouter.get("/stats", adminStats);
adminRouter.get("/organizations", listOrganizations);
adminRouter.get("/organizations/:organizationId", organizationDetails);
adminRouter.patch(
  "/organizations/:organizationId/status",
  validateBody(organizationStatusSchema),
  updateOrganizationStatus,
);

adminRouter.get("/plans", listPlans);
adminRouter.post("/plans", validateBody(createPlanSchema), createPlan);
adminRouter.patch("/plans/:planId", validateBody(updatePlanSchema), updatePlan);
adminRouter.get("/transactions", listPlatformTransactions);
