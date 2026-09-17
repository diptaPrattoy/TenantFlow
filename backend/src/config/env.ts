import "dotenv/config";

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const parsePort = (value: string | undefined) => {
  const port = Number(value ?? 5000);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer.");
  }

  return port;
};

const parsePositiveInteger = (
  name: string,
  value: string | undefined,
  fallback: number,
) => {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const parseBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  throw new Error("Boolean environment values must be true or false.");
};

const smtpHost = process.env.SMTP_HOST?.trim();
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.trim();
const smtpFromEmail = process.env.SMTP_FROM_EMAIL?.trim();
const smtpEnabled = Boolean(smtpHost && smtpUser && smtpPass && smtpFromEmail);

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
  stripeSecretKey: requireEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: requireEnv("STRIPE_WEBHOOK_SECRET"),
  smtp: {
    enabled: smtpEnabled,
    host: smtpHost ?? "",
    port: parsePositiveInteger("SMTP_PORT", process.env.SMTP_PORT, 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: smtpUser ?? "",
    pass: smtpPass ?? "",
    fromEmail: smtpFromEmail ?? "",
    fromName: process.env.SMTP_FROM_NAME?.trim() || "TenantFlow",
  },
} as const;
