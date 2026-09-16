import { Router } from "express";
import {
  forgotPassword,
  getMe,
  loginUser,
  resetUserPassword,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { loginRateLimit } from "../middleware/auth-rate-limit.middleware.js";
import { passwordResetRateLimit } from "../middleware/password-rate-limit.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { loginSchema } from "../schemas/auth.schema.js";
import { forgotPasswordSchema, resetPasswordSchema } from "../schemas/profile.schema.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, validateBody(loginSchema), loginUser);
authRouter.post(
  "/forgot-password",
  passwordResetRateLimit,
  validateBody(forgotPasswordSchema),
  forgotPassword,
);
authRouter.post(
  "/reset-password",
  passwordResetRateLimit,
  validateBody(resetPasswordSchema),
  resetUserPassword,
);
authRouter.get("/me", authenticate, getMe);
