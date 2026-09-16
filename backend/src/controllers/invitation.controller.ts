import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";
import { acceptOrganizationInvitation } from "../services/invitation.service.js";

export const acceptInvitation: RequestHandler = async (req, res) => {
  const token = req.params.token;

  if (typeof token !== "string" || token.length < 32) {
    throw new ApiError(400, "Invalid invitation token.");
  }

  const result = await acceptOrganizationInvitation(token, req.body);

  res.status(201).json({
    success: true,
    message: "Invitation accepted. You can now log in.",
    data: result,
  });
};
