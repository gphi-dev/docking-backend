import { Router } from "express";
import {
  createOrListRewards,
  createReward,
  deleteReward,
  drawRandomReward,
  drawReward,
  getRewardById,
  isCreateRewardRequestBody,
  updateRewardProbabilities,
  updateReward,
  updateRewardStatus,
} from "../controllers/rewards.controller.js";
import { requireAnyAdminPermission } from "../middleware/requireAdminPermission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rewardsRouter = Router();
export const rewardsPublicRouter = Router();

function isCreateRewardRequest(req) {
  return isCreateRewardRequestBody(req.body ?? {});
}

function requireRewardsRootPermission(req, res, next) {
  const permissionKeys = isCreateRewardRequest(req)
    ? ["rbac.manage", "rewards.create"]
    : ["rbac.manage", "rewards.view"];

  return requireAnyAdminPermission(permissionKeys)(req, res, next);
}

// POST /api/rewards/draw - draws all active rewards with holdings and probability for a validated game.
rewardsPublicRouter.post("/draw", asyncHandler(drawReward));

// POST /api/rewards/drawRandom - performs weighted random reward draws for a validated game.
rewardsPublicRouter.post("/drawRandom", asyncHandler(drawRandomReward));

// POST /api/rewards - lists rewards, or creates a reward for older clients that post a prize here.
rewardsRouter.post("/", requireRewardsRootPermission, asyncHandler(createOrListRewards));

// POST /api/rewards/create - creates a reward with admin auth only; no gamesecretkey is required.
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
