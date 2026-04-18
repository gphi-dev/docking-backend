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

export async function verifyDatabaseConnection() {
  await sequelize.authenticate();
}
