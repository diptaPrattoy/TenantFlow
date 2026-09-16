import type { RequestHandler } from "express";
import {
  cancelSubscription,
  changeSubscriptionPlan,
  createBillingPortalSession,
  getOrganizationTransactions,
  getPaymentHistory,
  getSubscriptionOverview,
} from "../services/billing.service.js";
import { ApiError } from "../errors/api-error.js";

export const getSubscription: RequestHandler = async (req, res) => {
  const data = await getSubscriptionOverview(req.tenant!.organizationId);
  res.status(200).json({ success: true, data });
};

export const changePlan: RequestHandler = async (req, res) => {
  const data = await changeSubscriptionPlan(req.tenant!.organizationId, req.body);
  res.status(200).json({
    success: true,
    message: "Subscription plan updated.",
    data,
  });
};

export const cancelCurrentSubscription: RequestHandler = async (req, res) => {
  const data = await cancelSubscription(req.tenant!.organizationId);
  res.status(200).json({
    success: true,
    message: "Subscription cancellation scheduled.",
    data,
  });
};

export const openBillingPortal: RequestHandler = async (req, res) => {
  const data = await createBillingPortalSession(req.tenant!.organizationId);
  res.status(200).json({ success: true, data });
};

export const listPayments: RequestHandler = async (req, res) => {
  const data = await getPaymentHistory(req.tenant!.organizationId);
  res.status(200).json({ success: true, data });
};

export const listTransactions: RequestHandler = async (req, res) => {
  const rawStatus = req.query.status;
  const allowed = ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "ROLLED_BACK"] as const;
  let status: (typeof allowed)[number] | undefined;

  if (rawStatus !== undefined) {
    if (typeof rawStatus !== "string" || !allowed.includes(rawStatus as (typeof allowed)[number])) {
      throw new ApiError(400, "Invalid transaction status filter.");
    }
    status = rawStatus as (typeof allowed)[number];
  }

  const data = await getOrganizationTransactions(req.tenant!.organizationId, status);
  res.status(200).json({ success: true, data });
};
