import express from "express";
import cors from "cors";
import path from "node:path";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
// import authRouter from "./routes/auth.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { listGames } from "./controllers/games.controller.js";
import { subscribersRouter } from "./routes/subscribers.routes.js";
import { adminsRouter } from "./routes/admins.routes.js";
import { usermobileRouter } from "./routes/usermobile.routes.js"; // Adjust path if needed
import { authenticateAdminJwt } from "./middleware/authenticateAdminJwt.js";
import { asyncHandler } from "./utils/asyncHandler.js";

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    // res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
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
  app.use("/uploads", express.static(path.resolve(process.cwd(), "public/uploads")));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.get("/api/games", asyncHandler(listGames));

  app.use("/api/games", authenticateAdminJwt, gamesRouter);
  app.use("/api/subscribers", authenticateAdminJwt, subscribersRouter);
  app.use("/api/admins", authenticateAdminJwt, adminsRouter);

  app.use("/api/usermobile", usermobileRouter);

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
