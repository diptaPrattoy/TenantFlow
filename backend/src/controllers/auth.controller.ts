import type { RequestHandler } from "express";
import { getCurrentUser, login } from "../services/auth.service.js";

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
