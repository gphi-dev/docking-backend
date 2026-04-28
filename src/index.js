import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { sequelize, verifyDatabaseConnection } from "./config/database.js";

function formatServerListenError(error) {
  if (error?.code === "EADDRINUSE") {
    return new Error(`Port ${env.port} is already in use.`);
  }

  if (error?.code === "EACCES") {
    return new Error(`Port ${env.port} requires elevated privileges.`);
  }

  return error;
}

async function closeSequelizeConnection() {
  try {
    await sequelize.close();
  } catch (error) {
    console.error("Error closing Sequelize:", error);
  }
}

async function waitForServerToListen(server) {
  return new Promise((resolve, reject) => {
    const handleListening = () => {
      cleanup();
      resolve();
    };

    const handleError = async (error) => {
      cleanup();
      await closeSequelizeConnection();
      reject(formatServerListenError(error));
    };

    const cleanup = () => {
      server.off("listening", handleListening);
      server.off("error", handleError);
    };

    server.once("listening", handleListening);
    server.once("error", handleError);
  });
}

async function startHttpServer() {
  const app = createApp();
  const server = app.listen(env.port);
  await waitForServerToListen(server);
  server.on("error", (error) => {
    console.error("HTTP server error:", formatServerListenError(error));
  });

  console.log(`API listening on port ${env.port} (${env.nodeEnv})`);

  verifyDatabaseConnection()
    .then(() => {
      console.log("Database connection verified");
    })
    .catch((error) => {
      console.error("Database connection verification failed:", error);
    });

  const shutdownSignals = ["SIGINT", "SIGTERM"];
  shutdownSignals.forEach((signalName) => {
    process.on(signalName, async () => {
      console.log(`Received ${signalName}, shutting down...`);
      server.close(async () => {
        await closeSequelizeConnection();
        process.exit(0);
      });
    });
  });
}

startHttpServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
