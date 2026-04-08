import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { sequelize, verifyDatabaseConnection } from "./config/database.js";

async function startHttpServer() {
  let databaseReady = false;
  const app = createApp({
    isDatabaseReady: () => databaseReady,
  });

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`API listening on 0.0.0.0:${env.port} (${env.nodeEnv})`);
  });

  await verifyDatabaseConnection();
  databaseReady = true;
  console.log("Database connection verified");

  const shutdownSignals = ["SIGINT", "SIGTERM"];
  shutdownSignals.forEach((signalName) => {
    process.on(signalName, async () => {
      console.log(`Received ${signalName}, shutting down...`);
      server.close(async () => {
        try {
          await sequelize.close();
        } catch (error) {
          console.error("Error closing Sequelize:", error);
        }
        process.exit(0);
      });
    });
  });
}

startHttpServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
