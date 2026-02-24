import { customAlphabet } from "nanoid";
import type {
  Game,
  Board,
  Player,
  SerializableGameState,
  SerializablePlayer,
  ScoreMap,
} from "./types.ts";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// ── In-memory game store (singleton via globalThis) ─────────────────────────
// Using globalThis so the same Map is shared between Next.js webpack-bundled
// API routes and the natively-loaded socket handler (server.ts).

declare global {
  // eslint-disable-next-line no-var
  var __jeopardy_games__: Map<string, Game> | undefined;
  // eslint-disable-next-line no-var
  var __jeopardy_cleanup__: ReturnType<typeof setInterval> | undefined;
}

if (!globalThis.__jeopardy_games__) {
  globalThis.__jeopardy_games__ = new Map<string, Game>();
}

const games: Map<string, Game> = globalThis.__jeopardy_games__;

// Cleanup: delete games older than 4 hours, every 5 minutes
if (!globalThis.__jeopardy_cleanup__) {
  globalThis.__jeopardy_cleanup__ = setInterval(() => {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    for (const [id, game] of games) {
      if (game.createdAt < cutoff) {
        games.delete(id);
      }
    }
  }, 5 * 60 * 1000);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createGame(
  hostSocketId: string,
  board: Board,
  finalJeopardy: { category: string; clueText: string; correctResponse: string }
): Game {
  const id = nanoid();
  const game: Game = {
    id,
    hostSocketId,
    displaySocketIds: new Set(),
    status: "lobby",
    board,
    players: new Map(),
    currentClue: null,
    buzzOrder: [],
    buzzDelayTimer: null,
    finalJeopardy: {
      category: finalJeopardy.category,
      clueText: finalJeopardy.clueText,
      correctResponse: finalJeopardy.correctResponse,
      state: "not_started",
      submissions: new Map(),
    },
    lastCorrectPlayerId: null,
    createdAt: Date.now(),
  };
  games.set(id, game);
  return game;
}

export function getGame(gameId: string): Game | undefined {
  return games.get(gameId);
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

export function addPlayer(
  game: Game,
  socketId: string,
  name: string
): Player {
  const id = nanoid();
  const player: Player = {
    id,
    socketId,
    name,
    score: 0,
    isConnected: true,
    finalWager: null,
    finalAnswer: null,
  };
  game.players.set(id, player);
  return player;
}

export function removePlayer(game: Game, playerId: string): void {
  const player = game.players.get(playerId);
  if (player) {
    player.isConnected = false;
  }
}

export function findPlayerBySocketId(
  game: Game,
  socketId: string
): Player | undefined {
  for (const player of game.players.values()) {
    if (player.socketId === socketId) return player;
  }
  return undefined;
}

export function findGameBySocketId(
  socketId: string
): { game: Game; player?: Player; isHost: boolean; isDisplay: boolean } | undefined {
  for (const game of games.values()) {
    if (game.hostSocketId === socketId) {
      return { game, isHost: true, isDisplay: false };
    }
    if (game.displaySocketIds.has(socketId)) {
      return { game, isHost: false, isDisplay: true };
    }
    const player = findPlayerBySocketId(game, socketId);
    if (player) {
      return { game, player, isHost: false, isDisplay: false };
    }
  }
  return undefined;
}

export function getScoreMap(game: Game): ScoreMap {
  const scores: ScoreMap = {};
  for (const [id, player] of game.players) {
    scores[id] = player.score;
  }
  return scores;
}

export function getSerializablePlayers(game: Game): SerializablePlayer[] {
  return Array.from(game.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isConnected: p.isConnected,
  }));
}

export function resetGameForNewRound(
  game: Game,
  newBoard: Board,
  newFinalJeopardy: { category: string; clueText: string; correctResponse: string }
): void {
  game.board = newBoard;
  game.status = "active";
  game.currentClue = null;
  game.buzzOrder = [];
  game.lastCorrectPlayerId = null;

  if (game.buzzDelayTimer) {
    clearTimeout(game.buzzDelayTimer);
    game.buzzDelayTimer = null;
  }

  game.finalJeopardy = {
    category: newFinalJeopardy.category,
    clueText: newFinalJeopardy.clueText,
    correctResponse: newFinalJeopardy.correctResponse,
    state: "not_started",
    submissions: new Map(),
  };

  // Reset all player scores to 0 and clear final jeopardy answers
  for (const player of game.players.values()) {
    player.score = 0;
    player.finalWager = null;
    player.finalAnswer = null;
  }
}

export function serializeGameState(game: Game): SerializableGameState {
  return {
    id: game.id,
    status: game.status,
    players: getSerializablePlayers(game),
    board: {
      categories: game.board.categories.map((cat) => ({
        name: cat.name,
        clues: cat.clues.map((clue) => ({
          value: clue.value,
          clueText: clue.clueText,
          isRevealed: clue.isRevealed,
          isDailyDouble: clue.isDailyDouble,
        })),
      })),
      dailyDoubleLocation: game.board.dailyDoubleLocation,
    },
    currentClue: game.currentClue
      ? {
          categoryIndex: game.currentClue.categoryIndex,
          clueIndex: game.currentClue.clueIndex,
          state: game.currentClue.state,
          answeringPlayerId: game.currentClue.answeringPlayerId,
          dailyDoubleWager: game.currentClue.dailyDoubleWager,
          playersWhoAttempted: Array.from(
            game.currentClue.playersWhoAttempted
          ),
        }
      : null,
    buzzOrder: game.buzzOrder,
    finalJeopardy: {
      category: game.finalJeopardy.category,
      clueText: game.finalJeopardy.clueText,
      state: game.finalJeopardy.state,
      submissions: Object.fromEntries(game.finalJeopardy.submissions),
    },
    lastCorrectPlayerId: game.lastCorrectPlayerId,
    scores: getScoreMap(game),
  };
}
