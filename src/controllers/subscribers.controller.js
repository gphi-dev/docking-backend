import { Subscriber, Game } from "../models/index.js";

const DEFAULT_SUBSCRIBER_PAGE_SIZE = 20;
const MAX_SUBSCRIBER_PAGE_SIZE = 100;

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }
  return parsedValue;
}

export async function listSubscribersForGame(req, res) {
  const gameId = Number(req.params.gameId);
  if (!Number.isFinite(gameId)) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const gameExists = await Game.findByPk(gameId);
  if (!gameExists) {
    return res.status(404).json({ message: "Game not found" });
  }

  const requestedPage = parsePositiveInteger(req.query.page, 1);
  const requestedPageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_SUBSCRIBER_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_SUBSCRIBER_PAGE_SIZE);

  const totalCount = await Subscriber.count({ where: { game_id: gameId } });
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const rows = await Subscriber.findAll({
    where: { game_id: gameId },
    order: [["created_at", "DESC"]],
    limit: pageSize,
    offset,
  });

  return res.json({
    items: rows,
    total: totalCount,
    page,
    pageSize,
    totalPages,
  });
}

export async function listTenMostRecentSubscribersAcrossGames(_req, res) {
  const subscribers = await Subscriber.findAll({
    include: [
      {
        model: Game,
        as: "game",
        attributes: ["id", "name"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: 10,
  });

  return res.json(subscribers);
}
