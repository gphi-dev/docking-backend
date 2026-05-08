import { Router } from "express";
import {
  createReward,
  deleteReward,
  drawReward,
  getRewardById,
  listRewards,
  updateRewardProbabilities,
  updateReward,
  updateRewardStatus,
} from "../controllers/rewards.controller.js";
import { requireAnyAdminPermission } from "../middleware/requireAdminPermission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rewardsRouter = Router();
export const rewardsPublicRouter = Router();

// POST /api/rewards/draw - draws all active rewards with holdings and probability for a validated game.
rewardsPublicRouter.post("/draw", asyncHandler(drawReward));

// POST /api/rewards - lists rewards with filters, search, and pagination.
rewardsRouter.post("/", requireAnyAdminPermission(["rbac.manage", "rewards.view"]), asyncHandler(listRewards));

// POST /api/rewards/create - creates a reward and recalculates game reward probabilities.
rewardsRouter.post("/create", requireAnyAdminPermission(["rbac.manage", "rewards.create"]), asyncHandler(createReward));

// PUT /api/rewards/probabilities - atomically updates all active reward probabilities for one game.
rewardsRouter.put(
  "/probabilities",
  requireAnyAdminPermission(["rbac.manage", "rewards.update"]),
  asyncHandler(updateRewardProbabilities),
);

// PATCH /api/rewards/:id/status - toggles reward active state and recalculates probabilities.
rewardsRouter.patch(
  "/:id/status",
  requireAnyAdminPermission(["rbac.manage", "rewards.update"]),
  asyncHandler(updateRewardStatus),
);

// GET /api/rewards/:id - fetches one reward by ID.
rewardsRouter.get("/:id", requireAnyAdminPermission(["rbac.manage", "rewards.view"]), asyncHandler(getRewardById));

// PUT /api/rewards/:id - updates reward fields and recalculates probabilities when needed.
rewardsRouter.put("/:id", requireAnyAdminPermission(["rbac.manage", "rewards.update"]), asyncHandler(updateReward));

// DELETE /api/rewards/:id - deletes a reward and recalculates remaining probabilities.
rewardsRouter.delete("/:id", requireAnyAdminPermission(["rbac.manage", "rewards.delete"]), asyncHandler(deleteReward));
