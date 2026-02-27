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
    rapidFireClues: [],
    currentClueIndex: -1,
  };
  games.set(id, game);

  // Fire-and-forget background generation
  startBackgroundGeneration(game);

  return game;
}

export async function startBackgroundGeneration(game: Game): Promise<void> {
  try {
    console.log(`[bg-gen] Starting ${game.gameMode} board generation for game ${game.id}`);
    const result = await generateBoard(game.generationParams!);

    if (game.gameMode === "rapid_fire") {
      // Rapid fire: populate flat clue list
      const rfResult = result as GenerateRapidFireResponse;
      game.rapidFireClues = rfResult.clues;
      game.currentClueIndex = -1;
    } else {
      // Classic: populate board grid
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

    console.log(`[bg-gen] Board ready for game ${game.id}`);

    // Broadcast to all clients in the game room
    const io = globalThis.__jeopardy_io__;
    if (io) {
      io.to(game.id).emit("game:board_ready");

      // If host already clicked Start, auto-start now
      // Batch board ready + game start into a single state_sync
      // to avoid flashing back to lobby between two syncs
      if (game.startRequested && game.players.size > 0) {
        game.status = "active";
        game.startRequested = false;
        io.to(game.id).emit("game:started");
        console.log(`[bg-gen] Auto-starting game ${game.id} (start was queued)`);
      }

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
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
  newRapidFireClues?: RapidFireClue[]
): void {
  game.board = newBoard;
  game.boardStatus = "ready";
  delete game.boardError;
  game.startRequested = false;
  game.status = "active";
  game.currentClue = null;
  game.buzzOrder = [];
  game.lastCorrectPlayerId = null;

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

  // Reset all player scores to 0 and clear final jeopardy answers
  for (const player of game.players.values()) {
    player.score = 0;
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
