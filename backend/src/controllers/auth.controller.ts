import type { RequestHandler } from "express";
import { getCurrentUser, login } from "../services/auth.service.js";
import { createPasswordReset, resetPassword } from "../services/profile.service.js";

export const loginUser: RequestHandler = async (req, res) => {
  const result = await login(req.body);

  res.status(200).json({
    success: true,
    message: "Login successful.",
    data: result,
  });
};

export const getMe: RequestHandler = async (req, res) => {
  const user = await getCurrentUser(req.user!.id);

  res.status(200).json({
    success: true,
    data: user,
  });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  const data = await createPasswordReset(req.body);
  res.status(200).json({
    success: true,
    message: "If the account exists, a password reset link has been created.",
    data,
  });
};

export const resetUserPassword: RequestHandler = async (req, res) => {
  await resetPassword(req.body);
  res.status(200).json({ success: true, message: "Password reset successfully." });
};
