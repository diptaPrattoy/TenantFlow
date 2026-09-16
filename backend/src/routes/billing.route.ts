import { Router } from "express";
import {
  cancelCurrentSubscription,
  changePlan,
  getSubscription,
  listPayments,
  listTransactions,
  openBillingPortal,
} from "../controllers/billing.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { requireOrganizationContext } from "../middleware/tenant.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { changePlanSchema } from "../schemas/billing.schema.js";

export const billingRouter = Router();

billingRouter.use(authenticate, requireOrganizationContext, allowRoles("ORG_ADMIN"));

billingRouter.get("/subscription", getSubscription);
billingRouter.patch("/subscription/plan", validateBody(changePlanSchema), changePlan);
billingRouter.post("/subscription/cancel", cancelCurrentSubscription);
billingRouter.post("/portal", openBillingPortal);
billingRouter.get("/payments", listPayments);
billingRouter.get("/transactions", listTransactions);
