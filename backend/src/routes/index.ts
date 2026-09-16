import { Router } from "express";
import { authRouter } from "./auth.route.js";
import { healthRouter } from "./health.route.js";
import { organizationRouter } from "./organization.route.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/organization", organizationRouter);
