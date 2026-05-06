import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { listGames } from "./controllers/games.controller.js";
import { subscribersRouter } from "./routes/subscribers.routes.js";
import { adminsRouter } from "./routes/admins.routes.js";
import { usermobileRouter } from "./routes/usermobile.routes.js";
import { rbacRouter } from "./routes/rbac.routes.js";
import { authenticateAdminJwt } from "./middleware/authenticateAdminJwt.js";
import { requireAdminPermission } from "./middleware/requireAdminPermission.js";
import { asyncHandler } from "./utils/asyncHandler.js";

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });

  const allowedOrigins =
    env.corsOrigins.length > 0
      ? env.corsOrigins
      : env.nodeEnv === "development"
        ? ["http://localhost:5173"]
        : env.defaultProductionCorsOrigins;

  const corsOptions =
    allowedOrigins.length > 0
      ? {
          origin: allowedOrigins,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization"],
          optionsSuccessStatus: 204,
        }
      : false;

  if (corsOptions) {
    app.use(cors(corsOptions));
    app.options("*", cors(corsOptions));
  }

  app.use(express.json({ limit: "1mb" }));

  // GET /health - service health probe for uptime checks.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // /api/auth/* - public authentication routes mounted from authRouter.
  app.use("/api/auth", authRouter);

  // GET /api/games - protected game catalog used by admin game management.
  app.get(
    "/api/games",
    authenticateAdminJwt,
    requireAdminPermission("games.view"),
    asyncHandler(listGames),
  );

  // /api/games/* - admin-protected game management routes.
  app.use("/api/games", authenticateAdminJwt, gamesRouter);

  // /api/subscribers/* - admin-protected subscriber reporting routes.
  app.use("/api/subscribers", authenticateAdminJwt, subscribersRouter);

  // /api/admins/* - admin-protected admin user management routes.
  app.use("/api/admins", authenticateAdminJwt, adminsRouter);

  // /api/rbac/* - admin-protected role and permission management routes.
  app.use("/api/rbac", authenticateAdminJwt, rbacRouter);

  // /api/usermobile/* - admin-protected mobile user and score-list routes.
  app.use("/api/usermobile", authenticateAdminJwt, usermobileRouter);

  // Fallback for traceable 404 responses when no endpoint matches.
  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
  });

  // Central error handler used by all asyncHandler-wrapped endpoints.
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
