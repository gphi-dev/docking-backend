import dotenv from "dotenv";

dotenv.config();

function readCommaSeparatedOrigins(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return [];
  }
  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  corsOrigins: readCommaSeparatedOrigins(process.env.CORS_ORIGINS),
database: {
    name: process.env.DB_NAME || "main",
    user: process.env.DB_USER || "dev",
    password: process.env.DB_PASSWORD || "3zqknH$$.^rjCFTP",
    host: process.env.DB_HOST || "136.110.11.139",
    port: Number(process.env.DB_PORT || 3306),
    
    // IMPORTANT: Change this back to null for local development
    socketPath: process.env.DB_SOCKET_PATH || null, 
    
    poolMax: Number(process.env.DB_POOL_MAX || 5),
    poolMin: Number(process.env.DB_POOL_MIN || 0),
    poolAcquireMs: Number(process.env.DB_POOL_ACQUIRE_MS || 30000),
    poolIdleMs: Number(process.env.DB_POOL_IDLE_MS || 10000),
  },
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "changeme",
};
