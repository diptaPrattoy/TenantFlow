import { Router } from "express";
import { getMe, loginUser } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { loginRateLimit } from "../middleware/auth-rate-limit.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { loginSchema } from "../schemas/auth.schema.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, validateBody(loginSchema), loginUser);
authRouter.get("/me", authenticate, getMe);
