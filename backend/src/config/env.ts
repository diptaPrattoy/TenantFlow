import "dotenv/config";

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 5000);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  return port;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
} as const;
