import { Router } from "express";
import { healthRouter } from "./health.route.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
