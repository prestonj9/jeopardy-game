import { customAlphabet } from "nanoid";
import type {
  Game,
  Board,
  Player,
  RapidFireClue,
  SerializableGameState,
  SerializablePlayer,
  ScoreMap,
  GenerateBoardRequest,
  GenerateBoardResponse,
  GenerateRapidFireResponse,
} from "./types.ts";
import { generateBoard } from "./ai-generator.ts";
import {
  getCachedBoard,
  incrementServed,
  saveBoard,
  getPoolCount,
  parseCachedClassic,
  parseCachedRapidFire,
  MAX_POOL_SIZE,
} from "./board-cache.ts";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// ── In-memory game store (singleton via globalThis) ─────────────────────────
// Using globalThis so the same Map is shared between Next.js webpack-bundled
// API routes and the natively-loaded socket handler (server.ts).

declare global {
  // eslint-disable-next-line no-var
  var __jeopardy_games__: Map<string, Game> | undefined;
  // eslint-disable-next-line no-var
  var __jeopardy_cleanup__: ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __jeopardy_io__: import("socket.io").Server | undefined;
  // eslint-disable-next-line no-var
  var __jeopardy_db__: import("better-sqlite3").Database | undefined;
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
    gameMode: "classic",
    status: "lobby",
    board,
    boardStatus: "ready",
    startRequested: false,
    players: new Map(),
    currentClue: null,
    buzzOrder: [],
    buzzDelayTimer: null,
    buzzWindowTimer: null,
    answerTimer: null,
    finalJeopardy: {
      category: finalJeopardy.category,
      clueText: finalJeopardy.clueText,
      correctResponse: finalJeopardy.correctResponse,
      state: "not_started",
      submissions: new Map(),
      revealOrder: [],
      currentRevealIndex: -1,
      currentRevealStep: "focus",
      judgments: new Map(),
      preRevealScores: {},
    },
    finalAnswerTimer: null,
    lastCorrectPlayerId: null,
    createdAt: Date.now(),
    round: 1,
    rapidFireClues: [],
    currentClueIndex: -1,
  };
  games.set(id, game);
  return game;
}

function createPlaceholderBoard(): Board {
  return {
    categories: Array.from({ length: 6 }, () => ({
      name: "...",
      clues: [200, 400, 600, 800, 1000].map((value) => ({
        value,
        clueText: "",
        correctResponse: "",
        isRevealed: false,
        isDailyDouble: false,
      })),
    })),
    dailyDoubleLocation: { categoryIndex: 0, clueIndex: 2 },
  };
}

export function createGameWithBackground(
  generationParams: GenerateBoardRequest
): Game {
  const id = nanoid();
  const gameMode = generationParams.gameMode ?? "classic";
  const game: Game = {
    id,
    hostSocketId: "pending",
    displaySocketIds: new Set(),
    gameMode,
    status: "lobby",
    board: createPlaceholderBoard(),
    boardStatus: "generating",
    generationParams,
    startRequested: false,
    players: new Map(),
    currentClue: null,
    buzzOrder: [],
    buzzDelayTimer: null,
    buzzWindowTimer: null,
    answerTimer: null,
    finalJeopardy: {
      category: "",
      clueText: "",
      correctResponse: "",
      state: "not_started",
      submissions: new Map(),
      revealOrder: [],
      currentRevealIndex: -1,
      currentRevealStep: "focus",
      judgments: new Map(),
      preRevealScores: {},
    },
    finalAnswerTimer: null,
    lastCorrectPlayerId: null,
    createdAt: Date.now(),
    round: 1,
    rapidFireClues: [],
    currentClueIndex: -1,
  };
  games.set(id, game);

  // Fire-and-forget background generation
  startBackgroundGeneration(game);

  return game;
}

/**
 * Look up a cached board or generate a fresh one. Saves new boards to the cache.
 * Shared by startBackgroundGeneration and host:new_round.
 */
export async function generateOrLookup(
  params: GenerateBoardRequest
): Promise<{ result: GenerateBoardResponse | GenerateRapidFireResponse; fromCache: boolean }> {
  const db = globalThis.__jeopardy_db__;
  const gameMode = params.gameMode ?? "classic";

  // Cache lookup (topic-based only, not uploads/links)
  if (db && params.mode === "topic" && params.topic) {
    const cached = getCachedBoard(db, params.topic, gameMode, params.clueCount);

    if (cached) {
      console.log(
        `[cache] HIT for "${params.topic}" (${gameMode}), served ${cached.times_served + 1} times`
      );
      incrementServed(db, cached.id);

      const result = gameMode === "rapid_fire"
        ? parseCachedRapidFire(cached)
        : parseCachedClassic(cached);

      return { result, fromCache: true };
    }

    console.log(`[cache] MISS for "${params.topic}" (${gameMode})`);
  }

  // Generate fresh board
  const result = await generateBoard(params);

  // Save to cache (topic-based only)
  if (db && params.mode === "topic" && params.topic) {
    try {
      if (gameMode === "rapid_fire") {
        const rfResult = result as GenerateRapidFireResponse;
        saveBoard(db, params.topic, "rapid_fire", JSON.stringify(rfResult.clues), JSON.stringify(rfResult.finalJeopardy), "claude-opus-4-6", params.clueCount);
      } else {
        const classicResult = result as GenerateBoardResponse;
        saveBoard(db, params.topic, "classic", JSON.stringify(classicResult.board), JSON.stringify(classicResult.finalJeopardy), "claude-opus-4-6");
      }
      console.log(`[cache] Saved board for "${params.topic}"`);
    } catch (cacheErr) {
      console.error("[cache] Failed to save (non-fatal):", cacheErr);
    }
  }

  return { result, fromCache: false };
}

/** How many boards to generate in parallel when growing the pool */
const POOL_GROWTH_BATCH = 3;

/**
 * Fire-and-forget: generate fresh boards and add them to the cache pool.
 * Generates up to POOL_GROWTH_BATCH boards in parallel, capped at MAX_POOL_SIZE.
 */
export async function growPool(params: GenerateBoardRequest, currentPoolSize: number): Promise<void> {
  const db = globalThis.__jeopardy_db__;
  if (!db || !params.topic) return;

  const gameMode = params.gameMode ?? "classic";
  const remaining = MAX_POOL_SIZE - currentPoolSize;
  const batchSize = Math.min(POOL_GROWTH_BATCH, remaining);

  if (batchSize <= 0) return;

  console.log(`[cache] Growing pool for "${params.topic}" by ${batchSize} boards in parallel`);

  const promises = Array.from({ length: batchSize }, () =>
    generateBoard(params).then((result) => {
      if (gameMode === "rapid_fire") {
        const rfResult = result as GenerateRapidFireResponse;
        saveBoard(db, params.topic!, "rapid_fire", JSON.stringify(rfResult.clues), JSON.stringify(rfResult.finalJeopardy), "claude-opus-4-6", params.clueCount);
      } else {
        const classicResult = result as GenerateBoardResponse;
        saveBoard(db, params.topic!, "classic", JSON.stringify(classicResult.board), JSON.stringify(classicResult.finalJeopardy), "claude-opus-4-6");
      }
    })
  );

  const results = await Promise.allSettled(promises);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[cache] Pool growth for "${params.topic}": ${succeeded} added, ${failed} failed`);
}

export async function startBackgroundGeneration(game: Game): Promise<void> {
  try {
    console.log(`[bg-gen] Starting ${game.gameMode} board generation for game ${game.id}`);
    const params = game.generationParams!;
    const { result, fromCache } = await generateOrLookup(params);

    if (game.gameMode === "rapid_fire") {
      const rfResult = result as GenerateRapidFireResponse;
      game.rapidFireClues = rfResult.clues;
      game.currentClueIndex = -1;
    } else {
      const classicResult = result as GenerateBoardResponse;
      game.board = classicResult.board;
    }

    game.finalJeopardy = {
      category: result.finalJeopardy.category,
      clueText: result.finalJeopardy.clueText,
      correctResponse: result.finalJeopardy.correctResponse,
      state: "not_started",
      submissions: new Map(),
      revealOrder: [],
      currentRevealIndex: -1,
      currentRevealStep: "focus",
      judgments: new Map(),
      preRevealScores: {},
    };
    game.boardStatus = "ready";
    delete game.boardError;

    console.log(`[bg-gen] Board ready for game ${game.id}${fromCache ? " (from cache)" : ""}`);

    // Broadcast to all clients in the game room
    const io = globalThis.__jeopardy_io__;
    if (io) {
      io.to(game.id).emit("game:board_ready");

      // If host already clicked Start, auto-start now
      if (game.startRequested && game.players.size > 0) {
        game.status = "active";
        game.startRequested = false;
        io.to(game.id).emit("game:started");
        console.log(`[bg-gen] Auto-starting game ${game.id} (start was queued)`);
      }

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    }

    // Pool growth: if pool isn't full, generate more boards in the background
    if (params.mode === "topic" && params.topic) {
      const db = globalThis.__jeopardy_db__;
      if (db) {
        const poolCount = getPoolCount(db, params.topic, params.gameMode ?? "classic", params.clueCount);
        if (poolCount < MAX_POOL_SIZE) {
          console.log(`[cache] Pool for "${params.topic}" is ${poolCount}/${MAX_POOL_SIZE}, growing in background`);
          growPool(params, poolCount).catch((err) => {
            console.error(`[cache] Background pool growth failed for "${params.topic}":`, err);
          });
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Board generation failed";
    console.error(`[bg-gen] Failed for game ${game.id}:`, message);
    game.boardStatus = "failed";
    game.boardError = message;
    game.startRequested = false;

    const io = globalThis.__jeopardy_io__;
    if (io) {
      io.to(game.id).emit("game:board_failed", { error: message });
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    }
  }
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
  newFinalJeopardy: { category: string; clueText: string; correctResponse: string },
  newRapidFireClues?: RapidFireClue[],
  resetScores: boolean = true
): void {
  game.board = newBoard;
  game.boardStatus = "ready";
  delete game.boardError;
  game.startRequested = false;
  game.status = "active";
  game.currentClue = null;
  game.buzzOrder = [];
  game.lastCorrectPlayerId = null;
  game.round += 1;

  // Rapid fire reset
  if (newRapidFireClues) {
    game.rapidFireClues = newRapidFireClues;
  }
  game.currentClueIndex = -1;

  if (game.buzzDelayTimer) {
    clearTimeout(game.buzzDelayTimer);
    game.buzzDelayTimer = null;
  }
  if (game.buzzWindowTimer) {
    clearTimeout(game.buzzWindowTimer);
    game.buzzWindowTimer = null;
  }
  if (game.answerTimer) {
    clearTimeout(game.answerTimer);
    game.answerTimer = null;
  }
  if (game.finalAnswerTimer) {
    clearTimeout(game.finalAnswerTimer);
    game.finalAnswerTimer = null;
  }

  game.finalJeopardy = {
    category: newFinalJeopardy.category,
    clueText: newFinalJeopardy.clueText,
    correctResponse: newFinalJeopardy.correctResponse,
    state: "not_started",
    submissions: new Map(),
    revealOrder: [],
    currentRevealIndex: -1,
    currentRevealStep: "focus",
    judgments: new Map(),
    preRevealScores: {},
  };

  // Reset player state for new round
  for (const player of game.players.values()) {
    if (resetScores) {
      player.score = 0;
    }
    player.finalWager = null;
    player.finalAnswer = null;
  }
}

export function serializeGameState(game: Game): SerializableGameState {
  // Get revealed correct response for current clue (works for both modes)
  let revealedCorrectResponse: string | undefined;
  if (game.currentClue?.state === "answer_revealed") {
    if (game.gameMode === "rapid_fire") {
      revealedCorrectResponse =
        game.rapidFireClues[game.currentClue.clueIndex]?.correctResponse;
    } else {
      revealedCorrectResponse =
        game.board.categories[game.currentClue.categoryIndex]?.clues[
          game.currentClue.clueIndex
        ]?.correctResponse;
    }
  }

  return {
    id: game.id,
    gameMode: game.gameMode,
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
          revealedCorrectResponse,
        }
      : null,
    buzzOrder: game.buzzOrder,
    finalJeopardy: {
      category: game.finalJeopardy.category,
      clueText: game.finalJeopardy.clueText,
      state: game.finalJeopardy.state,
      submissions: Object.fromEntries(game.finalJeopardy.submissions),
      revealOrder: game.finalJeopardy.revealOrder,
      currentRevealIndex: game.finalJeopardy.currentRevealIndex,
      currentRevealStep: game.finalJeopardy.currentRevealStep,
      judgments: Object.fromEntries(game.finalJeopardy.judgments),
      preRevealScores: game.finalJeopardy.preRevealScores,
    },
    lastCorrectPlayerId: game.lastCorrectPlayerId,
    scores: getScoreMap(game),
    boardStatus: game.boardStatus,
    boardError: game.boardError,
    round: game.round,
    // Rapid fire fields (strip correctResponse for players)
    rapidFireClues: game.rapidFireClues.map((clue) => ({
      clueText: clue.clueText,
      value: clue.value,
      subtopic: clue.subtopic,
      isRevealed: clue.isRevealed,
    })),
    currentClueIndex: game.currentClueIndex,
    totalClues: game.rapidFireClues.length,
  };
}
