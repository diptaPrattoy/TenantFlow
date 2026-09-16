import { Router } from "express";
import { getPublicPlans } from "../controllers/plan.controller.js";

export const planRouter = Router();

planRouter.get("/", getPublicPlans);
