import type { RequestHandler } from "express";
import {
  getOrganization,
  getOrganizationMembers,
} from "../services/organization.service.js";

export const getOrganizationProfile: RequestHandler = async (req, res) => {
  const organization = await getOrganization(
    req.tenant!.organizationId,
    req.user!.role,
  );

  res.status(200).json({
    success: true,
    data: organization,
  });
};

export const listOrganizationMembers: RequestHandler = async (req, res) => {
  const members = await getOrganizationMembers(req.tenant!.organizationId);

  res.status(200).json({
    success: true,
    data: members,
  });
};
