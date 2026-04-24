import {
  findGameById,
  findGameBySlug,
  listFeaturedPublicGames,
  listNewestPublicGames,
  listPublicGames,
} from "../repositories/games.repository.js";

export async function getGamesCatalog(options = {}) {
  const featuredLimit = options.featuredLimit ?? 10;
  const newLimit = options.newLimit ?? 10;

  const [games, featuredGames, newGames] = await Promise.all([
    listPublicGames(),
    listFeaturedPublicGames(featuredLimit),
    listNewestPublicGames(newLimit),
  ]);

  return {
    success: true,
    data: {
      games,
      featured_games: featuredGames,
      new_games: newGames,
    },
  };
}

export async function getGameDetailsById(gameId) {
  return findGameById(gameId, { includeGameSecretKey: true });
}

export async function getGameDetailsBySlug(slug) {
  return findGameBySlug(slug, { includeGameSecretKey: true });
}

export async function getGameDetailsByIdentifier(identifier) {
  const numericId = Number(identifier);
  if (Number.isFinite(numericId)) {
    const gameById = await getGameDetailsById(numericId);
    if (gameById) {
      return gameById;
    }
  }

  return getGameDetailsBySlug(identifier);
}
