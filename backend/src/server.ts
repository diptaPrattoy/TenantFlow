import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.port, () => {
  console.log(`TenantFlow API listening on http://localhost:${env.port}`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down TenantFlow API...`);

  server.close(async (error) => {
    await prisma.$disconnect();

    if (error) {
      console.error("Failed to close HTTP server cleanly.", error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
