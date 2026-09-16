import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`TenantFlow API listening on http://localhost:${env.port}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down TenantFlow API...`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server cleanly.", error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
