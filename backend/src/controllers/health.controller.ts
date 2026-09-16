import type { RequestHandler } from "express";
import { env } from "../config/env.js";

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TenantFlow API is healthy.",
    data: {
      service: "tenantflow-api",
      environment: env.nodeEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
};
