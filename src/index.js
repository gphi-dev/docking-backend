import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { sequelize, verifyDatabaseConnection } from "./config/database.js";

async function startHttpServer() {
  await verifyDatabaseConnection();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`API listening on port ${env.port} (${env.nodeEnv})`);
  });

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
