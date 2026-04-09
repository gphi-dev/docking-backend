import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
// import authRouter from "./routes/auth.routes.js";
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

  // update cors allow all origins , restrict to post method 
  const corsOptions = {
    // add * for ALL origins.
    origin: "*", 
    
    // restricts  HTTP methods to POST only. 
    methods: ["POST"], 
    
    // added: Returns a 200 compatibility.
    optionsSuccessStatus: 200 
  };

  app.use(cors(corsOptions));

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

  // blocks all GET request because POST-only CORS policy.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);

  app.use("/api/games", authenticateAdminJwt, gamesRouter);
  app.use("/api/subscribers", authenticateAdminJwt, subscribersRouter);
  app.use("/api/admins", authenticateAdminJwt, adminsRouter);

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