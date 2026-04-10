import { app } from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./db/pool.js";

const server = app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});

async function shutdown(): Promise<void> {
  console.log("Shutting down backend...");
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
