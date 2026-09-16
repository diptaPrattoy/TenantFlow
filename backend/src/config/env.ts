import "dotenv/config";

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 5000);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  return port;
};

const parsePositiveInteger = (
  name: string,
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const jwtSecret = requireEnv("JWT_SECRET");

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret,
  jwtExpiresInSeconds: parsePositiveInteger(
    "JWT_EXPIRES_IN_SECONDS",
    process.env.JWT_EXPIRES_IN_SECONDS,
    3600,
  ),
} as const;
