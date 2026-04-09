import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { subscribersRouter } from "./routes/subscribers.routes.js";
import { adminsRouter } from "./routes/admins.routes.js";
import { authenticateAdminJwt } from "./middleware/authenticateAdminJwt.js";

/**
 * @param {object} [options]
 * @param {() => boolean} [options.isDatabaseReady] When set, non-health routes return 503 until true (listen-before-DB startup).
 */
export function createApp(options = {}) {
  const { isDatabaseReady } = options;
  const app = express();

  // Public CORS: Allows ANY origin
  const publicCors = cors({
    origin: "*", 
    methods: ["POST", "OPTIONS"], // OPTIONS is required for browsers to complete preflight checks
    optionsSuccessStatus: 200 
  });

  // Admin CORS: Locks down admin routes to ONLY your trusted dashboard domains
  const adminCors = cors({
    origin: [
      "http://localhost:5173",  //  local frontend
      "https://localhost:3000"   //  local or Production admin URL
    ], 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
    optionsSuccessStatus: 200 
  });


  app.use(express.json({ limit: "1mb" }));

  if (typeof isDatabaseReady === "function") {
    app.use((req, res, next) => {
      if (req.path === "/health") {
        return next();
      }
      if (!isDatabaseReady()) {
        return res.status(503).json({ message: "Database not ready" });
      }
      return next();
    });
  }

  
  app.get("/health", cors(), (_req, res) => {
    res.json({ status: "ok" });
  });

  // Apply the PUBLIC cors rule to the Auth routes (so anyone can login to the game)
  app.use("/api/auth", publicCors, authRouter);

  // Apply the RESTRICTED Admin cors rule to your secure management routes
  app.use("/api/games", adminCors, authenticateAdminJwt, gamesRouter);
  app.use("/api/subscribers", adminCors, authenticateAdminJwt, subscribersRouter);
  app.use("/api/admins", adminCors, authenticateAdminJwt, adminsRouter);

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    const statusCode = Number(error.statusCode || error.status || 500);
    const safeStatusCode = Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    const message =
      safeStatusCode === 500 ? "Internal server error" : error.message || "Request failed";
    return res.status(safeStatusCode).json({ message });
  });

  return app;
}