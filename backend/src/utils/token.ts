import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

interface AccessTokenPayload {
  sub: string;
}

export const createAccessToken = (userId: string): string =>
  jwt.sign({}, env.jwtSecret, {
    subject: userId,
    expiresIn: env.jwtExpiresInSeconds,
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, env.jwtSecret);

  if (typeof payload === "string" || !payload.sub) {
    throw new jwt.JsonWebTokenError("Invalid token payload.");
  }

  return { sub: payload.sub };
};
