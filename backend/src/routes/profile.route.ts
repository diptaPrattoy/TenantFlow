import { Router } from "express";
import {
  changeOwnPassword,
  getOwnProfile,
  updateOwnProfile,
} from "../controllers/profile.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import {
  changePasswordSchema,
  updateProfileSchema,
} from "../schemas/profile.schema.js";

export const profileRouter = Router();

profileRouter.use(authenticate);
profileRouter.get("/", getOwnProfile);
profileRouter.patch("/", validateBody(updateProfileSchema), updateOwnProfile);
profileRouter.patch("/password", validateBody(changePasswordSchema), changeOwnPassword);
