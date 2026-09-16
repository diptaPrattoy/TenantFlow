import type { RequestHandler } from "express";
import { listPublicPlans } from "../services/plan.service.js";

export const getPublicPlans: RequestHandler = async (_req, res) => {
  const plans = await listPublicPlans();

  res.status(200).json({
    success: true,
    data: plans,
  });
};
