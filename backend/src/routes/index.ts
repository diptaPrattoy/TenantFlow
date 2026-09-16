import { Router } from "express";
import { adminRouter } from "./admin.route.js";
import { authRouter } from "./auth.route.js";
import { billingRouter } from "./billing.route.js";
import { healthRouter } from "./health.route.js";
import { invitationRouter } from "./invitation.route.js";
import { organizationRouter } from "./organization.route.js";
import { planRouter } from "./plan.route.js";
import { profileRouter } from "./profile.route.js";
import { registrationRouter } from "./registration.route.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/plans", planRouter);
apiRouter.use("/registration", registrationRouter);
apiRouter.use("/invitations", invitationRouter);
apiRouter.use("/organization", organizationRouter);
apiRouter.use("/billing", billingRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/admin", adminRouter);
