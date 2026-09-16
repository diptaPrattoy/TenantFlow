import type { RequestHandler } from "express";
import {
  changeOrganizationMemberRole,
  getOrganization,
  getOrganizationMembers,
  inviteOrganizationMember,
  removeOrganizationMember,
  updateOrganization,
} from "../services/organization.service.js";
import { ApiError } from "../errors/api-error.js";

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

export const updateOrganizationProfile: RequestHandler = async (req, res) => {
  const organization = await updateOrganization(
    req.tenant!.organizationId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Organization profile updated.",
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

export const inviteMember: RequestHandler = async (req, res) => {
  const invitation = await inviteOrganizationMember(
    req.tenant!.organizationId,
    req.user!.id,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: "Member invitation created.",
    data: invitation,
  });
};

export const changeMemberRole: RequestHandler = async (req, res) => {
  const memberId = req.params.memberId;

  if (typeof memberId !== "string") {
    throw new ApiError(400, "Invalid member ID.");
  }

  const member = await changeOrganizationMemberRole(
    req.tenant!.organizationId,
    req.user!.id,
    memberId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Member role updated.",
    data: member,
  });
};

export const removeMember: RequestHandler = async (req, res) => {
  const memberId = req.params.memberId;

  if (typeof memberId !== "string") {
    throw new ApiError(400, "Invalid member ID.");
  }

  await removeOrganizationMember(
    req.tenant!.organizationId,
    req.user!.id,
    memberId,
  );

  res.status(200).json({
    success: true,
    message: "Member removed from the organization.",
  });
};
