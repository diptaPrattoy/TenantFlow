import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";
import {
  createAdminPlan,
  getAdminPlans,
  getAdminStats,
  getOrganizationDetails,
  getOrganizations,
  getPlatformTransactions,
  setOrganizationStatus,
  updateAdminPlan,
} from "../services/admin.service.js";

const param = (value: string | string[] | undefined, name: string) => {
  if (typeof value !== "string") {
    throw new ApiError(400, `Invalid ${name}.`);
  }
  return value;
};

export const adminStats: RequestHandler = async (_req, res) => {
  res.status(200).json({ success: true, data: await getAdminStats() });
};

export const listOrganizations: RequestHandler = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const statusRaw = req.query.status;
  const planId = typeof req.query.planId === "string" ? req.query.planId : undefined;
  const statuses = ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELLED"] as const;

  let status: (typeof statuses)[number] | undefined;
  if (statusRaw !== undefined) {
    if (typeof statusRaw !== "string" || !statuses.includes(statusRaw as (typeof statuses)[number])) {
      throw new ApiError(400, "Invalid organization status filter.");
    }
    status = statusRaw as (typeof statuses)[number];
  }

  const data = await getOrganizations({ search: search || undefined, status, planId });
  res.status(200).json({ success: true, data });
};

export const organizationDetails: RequestHandler = async (req, res) => {
  const data = await getOrganizationDetails(param(req.params.organizationId, "organization ID"));
  res.status(200).json({ success: true, data });
};

export const updateOrganizationStatus: RequestHandler = async (req, res) => {
  const data = await setOrganizationStatus(
    param(req.params.organizationId, "organization ID"),
    req.body,
  );
  res.status(200).json({
    success: true,
    message: `Organization ${data.status === "ACTIVE" ? "reactivated" : "suspended"}.`,
    data,
  });
};

export const listPlans: RequestHandler = async (_req, res) => {
  res.status(200).json({ success: true, data: await getAdminPlans() });
};

export const createPlan: RequestHandler = async (req, res) => {
  const data = await createAdminPlan(req.body);
  res.status(201).json({ success: true, message: "Plan created.", data });
};

export const updatePlan: RequestHandler = async (req, res) => {
  const data = await updateAdminPlan(param(req.params.planId, "plan ID"), req.body);
  res.status(200).json({ success: true, message: "Plan updated.", data });
};

export const listPlatformTransactions: RequestHandler = async (req, res) => {
  const statusRaw = req.query.status;
  const statuses = ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "ROLLED_BACK"] as const;
  let status: (typeof statuses)[number] | undefined;

  if (statusRaw !== undefined) {
    if (typeof statusRaw !== "string" || !statuses.includes(statusRaw as (typeof statuses)[number])) {
      throw new ApiError(400, "Invalid transaction status filter.");
    }
    status = statusRaw as (typeof statuses)[number];
  }

  const organizationId =
    typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

  if (from && Number.isNaN(from.getTime())) throw new ApiError(400, "Invalid from date.");
  if (to && Number.isNaN(to.getTime())) throw new ApiError(400, "Invalid to date.");

  const data = await getPlatformTransactions({ organizationId, status, from, to });
  res.status(200).json({ success: true, data });
};
