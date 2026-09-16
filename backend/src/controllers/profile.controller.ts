import type { RequestHandler } from "express";
import {
  changePassword,
  getProfile,
  updateProfile,
} from "../services/profile.service.js";

export const getOwnProfile: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, data: await getProfile(req.user!.id) });
};

export const updateOwnProfile: RequestHandler = async (req, res) => {
  const data = await updateProfile(req.user!.id, req.body);
  res.status(200).json({ success: true, message: "Profile updated.", data });
};

export const changeOwnPassword: RequestHandler = async (req, res) => {
  await changePassword(req.user!.id, req.body);
  res.status(200).json({ success: true, message: "Password changed successfully." });
};
