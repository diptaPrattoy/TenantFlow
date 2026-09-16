import { Router } from "express";
import { authRouter } from "./auth.route.js";
import { healthRouter } from "./health.route.js";
import { invitationRouter } from "./invitation.route.js";
import { organizationRouter } from "./organization.route.js";
import { planRouter } from "./plan.route.js";
import { registrationRouter } from "./registration.route.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/plans", planRouter);
apiRouter.use("/registration", registrationRouter);
apiRouter.use("/invitations", invitationRouter);
apiRouter.use("/organization", organizationRouter);
