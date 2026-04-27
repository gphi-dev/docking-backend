import {
  findGameById,
  findGameBySlug,
  listFeaturedPublicGames,
  listNewestPublicGames,
  listPublicGames,
} from "../repositories/games.repository.js";

function includeGameUrl(game) {
  if (!game) {
    return game;
  }

  const { id, game_id, game_url, ...rest } = game;
  return {
    id,
    game_id: game_id ?? null,
    game_url: game_url ?? null,
    ...rest,
  };
}

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
      games: games.map(includeGameUrl),
      featured_games: featuredGames.map(includeGameUrl),
      new_games: newGames.map(includeGameUrl),
    },
  };
}

export async function getGameDetailsById(gameId) {
  return includeGameUrl(await findGameById(gameId, { includeGameSecretKey: true }));
}

export async function getGameDetailsBySlug(slug) {
  return includeGameUrl(await findGameBySlug(slug, { includeGameSecretKey: true }));
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
