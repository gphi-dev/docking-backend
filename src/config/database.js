import { Sequelize } from "sequelize";
import { env } from "./env.js";

/**
 * Cloud Run / serverless notes:
 * - Keep pool max small per container; scale horizontally instead of large pools.
 * - min: 0 allows connections to be released when idle (helps during scale-to-zero).
 * - Prefer Cloud SQL Unix socket (DB_SOCKET_PATH) on Cloud Run for lower latency and IAM-friendly setups.
 */
const commonOptions = {
  dialect: "mysql",
  logging: env.nodeEnv === "development" ? console.log : false,
  pool: {
    max: env.database.poolMax,
    min: env.database.poolMin,
    acquire: env.database.poolAcquireMs,
    idle: env.database.poolIdleMs,
  },
  dialectOptions: {
    decimalNumbers: true,
  },
  define: {
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
};

function buildSequelizeOptions() {
  if (env.database.socketPath) {
    return {
      ...commonOptions,
      dialectOptions: {
        ...commonOptions.dialectOptions,
        socketPath: env.database.socketPath,
      },
    };
  }
  return {
    ...commonOptions,
    host: env.database.host,
    port: env.database.port,
  };
}

export const sequelize = new Sequelize(
  env.database.name,
  env.database.user,
  env.database.password,
  buildSequelizeOptions(),
);

function logDatabaseConnectionTarget() {
  const databaseName = env.database.name;
  if (env.database.socketPath) {
    console.log(
      `MySQL: using Unix socket (database=${databaseName}, socket=${env.database.socketPath})`,
    );
    return;
  }
  console.log(
    `MySQL: using TCP (database=${databaseName}, host=${env.database.host}, port=${env.database.port})`,
  );
  if (
    env.nodeEnv === "production" &&
    (env.database.host === "127.0.0.1" || env.database.host === "localhost")
  ) {
    console.error(
      "Database misconfiguration: production is targeting loopback (127.0.0.1/localhost). " +
        "On Cloud Run there is no MySQL on localhost. Use Cloud SQL: set DB_SOCKET_PATH to " +
        "/cloudsql/PROJECT:REGION:INSTANCE and deploy the service with the matching " +
        "--add-cloudsql-instances flag (or use a VPC connector and the instance private IP as DB_HOST).",
    );
  }
}

function extractConnectionErrorCause(error) {
  return error?.parent ?? error?.original ?? error;
}

function isSocketPathMissingError(error) {
  const cause = extractConnectionErrorCause(error);
  return cause?.code === "ENOENT";
}

async function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyDatabaseConnection() {
  logDatabaseConnectionTarget();

  const maxAttempts = Math.max(1, Number(process.env.DB_CONNECT_MAX_ATTEMPTS || 30));
  const retryDelayMs = Math.max(100, Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2000));

  let lastError;
  for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex++) {
    try {
      await sequelize.authenticate();
      if (attemptIndex > 1) {
        console.log(`Database: connected after ${attemptIndex} attempts`);
      }
      return;
    } catch (error) {
      lastError = error;
      const cause = extractConnectionErrorCause(error);
      const errorCode = cause?.code ?? "unknown";
      const errorMessage = cause?.message ?? error.message;

      const shouldLogThisAttempt =
        attemptIndex === 1 ||
        attemptIndex === maxAttempts ||
        attemptIndex % 5 === 0;
      if (shouldLogThisAttempt) {
        console.error(
          `Database: attempt ${attemptIndex}/${maxAttempts} failed (${errorCode}): ${errorMessage}`,
        );
      }

      if (attemptIndex === 1 && env.database.socketPath && isSocketPathMissingError(error)) {
        console.error(
          "Cloud SQL socket is missing (ENOENT). In the Cloud Run service, open Connections → Cloud SQL " +
            "and add the instance whose connection name matches DB_SOCKET_PATH " +
            "(format PROJECT:REGION:INSTANCE, same as /cloudsql/... on disk).",
        );
      }

      if (attemptIndex >= maxAttempts) {
        break;
      }
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}
