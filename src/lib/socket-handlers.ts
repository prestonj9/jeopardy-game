import type { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  Game,
  FinalState,
} from "./types.ts";
import {
  getGame,
  addPlayer,
  findGameBySocketId,
  getScoreMap,
  serializeGameState,
} from "./game-manager.ts";

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const BUZZ_DELAY_SECONDS = 4;

/** Clear any running buzz delay timer for a game */
function clearBuzzTimer(game: Game): void {
  if (game.buzzDelayTimer) {
    clearTimeout(game.buzzDelayTimer);
    game.buzzDelayTimer = null;
  }
}

/** Start a countdown that auto-opens buzzers after BUZZ_DELAY_SECONDS */
function startBuzzCountdown(io: TypedServer, game: Game): void {
  let countdown = BUZZ_DELAY_SECONDS;

  io.to(game.id).emit("game:buzz_countdown", { secondsRemaining: countdown });

  const tick = () => {
    countdown--;
    if (countdown > 0) {
      io.to(game.id).emit("game:buzz_countdown", { secondsRemaining: countdown });
      game.buzzDelayTimer = setTimeout(tick, 1000);
    } else {
      // Time's up — open buzzers
      if (game.currentClue && game.currentClue.state === "showing_clue") {
        game.currentClue.state = "buzzing_open";
        game.currentClue.buzzWindowOpenedAt = Date.now();
        game.buzzOrder = [];
        io.to(game.id).emit("game:buzz_countdown", { secondsRemaining: 0 });
        io.to(game.id).emit("game:buzzing_open");
        io.to(game.id).emit("game:state_sync", serializeGameState(game));
      }
      game.buzzDelayTimer = null;
    }
  };

  game.buzzDelayTimer = setTimeout(tick, 1000);
}

export function registerSocketHandlers(io: TypedServer): void {
  io.on("connection", (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // ── Host: Create Game (from host phone remote) ────────────────────
    socket.on("host:create_game", (data) => {
      console.log(`[host:create_game] gameId=${data.gameId} socketId=${socket.id}`);
      const game = getGame(data.gameId);
      if (!game) {
        console.log(`[host:create_game] Game NOT FOUND: ${data.gameId}`);
        socket.emit("game:error", { message: `Game "${data.gameId}" not found. It may have expired — create a new one.` });
        return;
      }
      console.log(`[host:create_game] Game found, sending state_sync`);
      game.hostSocketId = socket.id;
      socket.data.gameId = data.gameId;
      socket.data.isHost = true;
      socket.join(data.gameId);
      socket.emit("game:state_sync", serializeGameState(game));
    });

    // ── Display: Join (passive viewer for TV/projector) ───────────────
    socket.on("display:join", (data) => {
      console.log(`[display:join] gameId=${data.gameId} socketId=${socket.id}`);
      const game = getGame(data.gameId);
      if (!game) {
        console.log(`[display:join] Game NOT FOUND: ${data.gameId}`);
        socket.emit("game:error", { message: `Game "${data.gameId}" not found. It may have expired — create a new one.` });
        return;
      }
      console.log(`[display:join] Game found, sending state_sync`);
      game.displaySocketIds.add(socket.id);
      socket.data.gameId = data.gameId;
      socket.data.isDisplay = true;
      socket.join(data.gameId);
      socket.emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Start Game ──────────────────────────────────────────────
    socket.on("host:start_game", () => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      if (game.status !== "lobby") return;
      if (game.players.size === 0) {
        socket.emit("game:error", {
          message: "Need at least 1 player to start",
        });
        return;
      }

      game.status = "active";
      io.to(game.id).emit("game:started");
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Select Clue ─────────────────────────────────────────────
    socket.on("host:select_clue", (data) => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      if (game.status !== "active" || game.currentClue) return;

      const { categoryIndex, clueIndex } = data;
      const category = game.board.categories[categoryIndex];
      if (!category) return;
      const clue = category.clues[clueIndex];
      if (!clue || clue.isRevealed) return;

      game.currentClue = {
        categoryIndex,
        clueIndex,
        state: clue.isDailyDouble ? "daily_double_wager" : "showing_clue",
        answeringPlayerId: null,
        dailyDoubleWager: null,
        buzzWindowOpenedAt: 0,
        playersWhoAttempted: new Set(),
      };
      game.buzzOrder = [];

      // Send clue to all (no correct response)
      io.to(game.id).emit("game:clue_selected", {
        categoryIndex,
        clueIndex,
        clueText: clue.clueText,
        value: clue.value,
        isDailyDouble: clue.isDailyDouble,
      });

      // Send correct response to host only
      socket.emit("game:host_clue_answer", {
        correctResponse: clue.correctResponse,
      });

      // If Daily Double, prompt the designated player
      if (clue.isDailyDouble) {
        const designatedId = game.lastCorrectPlayerId || getRandomPlayerId(game);
        if (designatedId) {
          game.currentClue.answeringPlayerId = designatedId;
          const designatedPlayer = game.players.get(designatedId);
          if (designatedPlayer) {
            const maxWager = Math.max(designatedPlayer.score, 1000);
            const playerSocket = findSocketById(io, designatedPlayer.socketId);
            if (playerSocket) {
              playerSocket.emit("game:daily_double_wager_prompt", {
                maxWager,
              });
            }
          }
        }
      } else {
        // Non-Daily-Double: start auto-buzz countdown
        startBuzzCountdown(io, game);
      }

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Judge Answer ────────────────────────────────────────────
    socket.on("host:judge", (data) => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      if (!game.currentClue || game.currentClue.state !== "player_answering")
        return;

      // Clear any running buzz timer
      clearBuzzTimer(game);

      const clue = game.currentClue;
      const player = game.players.get(clue.answeringPlayerId!);
      if (!player) return;

      const clueData =
        game.board.categories[clue.categoryIndex].clues[clue.clueIndex];
      const value = clue.dailyDoubleWager ?? clueData.value;

      if (data.correct) {
        player.score += value;
        game.lastCorrectPlayerId = player.id;
        clueData.isRevealed = true;
        game.currentClue = null;

        io.to(game.id).emit("game:judge_result", {
          playerId: player.id,
          correct: true,
          scores: getScoreMap(game),
          clueComplete: true,
        });
        io.to(game.id).emit("game:clue_complete", {
          correctResponse: clueData.correctResponse,
        });
      } else {
        player.score -= value;
        clue.playersWhoAttempted.add(player.id);
        clue.answeringPlayerId = null;

        // For Daily Double, incorrect ends the clue immediately
        if (clueData.isDailyDouble) {
          clueData.isRevealed = true;
          game.currentClue = null;

          io.to(game.id).emit("game:judge_result", {
            playerId: player.id,
            correct: false,
            scores: getScoreMap(game),
            clueComplete: true,
          });
          io.to(game.id).emit("game:clue_complete", {
            correctResponse: clueData.correctResponse,
          });
        } else {
          const canStillBuzz = [...game.players.values()].filter(
            (p) =>
              p.isConnected && !clue.playersWhoAttempted.has(p.id)
          );

          const clueComplete = canStillBuzz.length === 0;

          io.to(game.id).emit("game:judge_result", {
            playerId: player.id,
            correct: false,
            scores: getScoreMap(game),
            clueComplete,
          });

          if (canStillBuzz.length > 0) {
            // Re-open buzzers immediately (no new countdown — audience already read the clue)
            clue.state = "buzzing_open";
            game.buzzOrder = [];
            io.to(game.id).emit("game:buzzing_open");
          } else {
            clueData.isRevealed = true;
            game.currentClue = null;
            io.to(game.id).emit("game:clue_complete", {
              correctResponse: clueData.correctResponse,
            });
          }
        }
      }

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Skip Clue ───────────────────────────────────────────────
    socket.on("host:skip_clue", () => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      if (!game.currentClue) return;

      // Clear any running buzz timer
      clearBuzzTimer(game);

      const clueData =
        game.board.categories[game.currentClue.categoryIndex].clues[
          game.currentClue.clueIndex
        ];
      clueData.isRevealed = true;
      const correctResponse = clueData.correctResponse;
      game.currentClue = null;

      io.to(game.id).emit("game:clue_complete", { correctResponse });
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Start Final Jeopardy ────────────────────────────────────
    socket.on("host:start_final", () => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      game.status = "final_jeopardy";
      game.finalJeopardy.state = "show_category";

      io.to(game.id).emit("game:final_started", {
        category: game.finalJeopardy.category,
      });
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Advance Final Jeopardy ──────────────────────────────────
    socket.on("host:advance_final", () => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      const fj = game.finalJeopardy;
      const transitions: Record<string, string> = {
        show_category: "wagering",
        wagering: "show_clue",
        show_clue: "answering",
        answering: "judging",
        judging: "results",
      };

      const nextState = transitions[fj.state];
      if (!nextState) return;

      fj.state = nextState as FinalState;

      if (nextState === "show_clue" || nextState === "answering") {
        io.to(game.id).emit("game:final_clue", {
          clueText: fj.clueText,
        });
      }

      io.to(game.id).emit("game:final_advanced", {
        newState: fj.state,
      });
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Host: Judge Final Jeopardy ────────────────────────────────────
    socket.on("host:judge_final", (data) => {
      const result = findGameBySocketId(socket.id);
      if (!result || !result.isHost) return;
      const { game } = result;

      const player = game.players.get(data.playerId);
      if (!player) return;

      const submission = game.finalJeopardy.submissions.get(data.playerId);
      const wager = submission?.wager ?? 0;
      const answer = submission?.answer ?? "(no answer)";

      if (data.correct) {
        player.score += wager;
      } else {
        player.score -= wager;
      }

      io.to(game.id).emit("game:final_judge_result", {
        playerId: data.playerId,
        playerName: player.name,
        correct: data.correct,
        wager,
        answer,
        finalScores: getScoreMap(game),
      });
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Player: Join ──────────────────────────────────────────────────
    socket.on("player:join", (data, callback) => {
      const game = getGame(data.gameId);
      if (!game) {
        callback({ success: false, error: "Game not found" });
        return;
      }
      if (game.status !== "lobby") {
        // Allow reconnection during active game
        const existingPlayer = [...game.players.values()].find(
          (p) => p.name === data.playerName && !p.isConnected
        );
        if (existingPlayer) {
          existingPlayer.socketId = socket.id;
          existingPlayer.isConnected = true;
          socket.data.gameId = game.id;
          socket.data.playerId = existingPlayer.id;
          socket.join(game.id);
          callback({ success: true, playerId: existingPlayer.id });
          io.to(game.id).emit("game:state_sync", serializeGameState(game));
          return;
        }
        callback({ success: false, error: "Game already in progress" });
        return;
      }

      const player = addPlayer(game, socket.id, data.playerName);
      socket.data.gameId = game.id;
      socket.data.playerId = player.id;
      socket.join(game.id);

      callback({ success: true, playerId: player.id });

      io.to(game.id).emit("game:player_joined", {
        id: player.id,
        name: player.name,
        score: 0,
        isConnected: true,
      });
      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Player: Buzz ──────────────────────────────────────────────────
    socket.on("player:buzz", () => {
      const result = findGameBySocketId(socket.id);
      if (!result || result.isHost || result.isDisplay || !result.player) return;
      const { game, player } = result;

      const clue = game.currentClue;
      if (!clue || clue.state !== "buzzing_open") return;
      if (clue.playersWhoAttempted.has(player.id)) return;

      // Check if this player already buzzed
      if (game.buzzOrder.some((b) => b.playerId === player.id)) return;

      game.buzzOrder.push({
        playerId: player.id,
        timestamp: Date.now(),
      });

      // First buzz wins
      if (game.buzzOrder.length === 1) {
        clue.state = "player_answering";
        clue.answeringPlayerId = player.id;
        io.to(game.id).emit("game:player_buzzed", {
          playerId: player.id,
          playerName: player.name,
        });
      }
    });

    // ── Player: Daily Double Wager ────────────────────────────────────
    socket.on("player:daily_double_wager", (data) => {
      const result = findGameBySocketId(socket.id);
      if (!result || result.isHost || !result.player) return;
      const { game, player } = result;

      const clue = game.currentClue;
      if (!clue || clue.state !== "daily_double_wager") return;
      if (clue.answeringPlayerId !== player.id) return;

      const maxWager = Math.max(player.score, 1000);
      const wager = Math.max(5, Math.min(data.amount, maxWager));

      clue.dailyDoubleWager = wager;
      clue.state = "showing_clue";

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Player: Final Jeopardy Wager ──────────────────────────────────
    socket.on("player:final_wager", (data) => {
      const result = findGameBySocketId(socket.id);
      if (!result || result.isHost || !result.player) return;
      const { game, player } = result;

      if (
        game.status !== "final_jeopardy" ||
        game.finalJeopardy.state !== "wagering"
      )
        return;

      const maxWager = Math.max(player.score, 0);
      const wager = Math.max(0, Math.min(data.amount, maxWager));

      const existing = game.finalJeopardy.submissions.get(player.id);
      game.finalJeopardy.submissions.set(player.id, {
        wager,
        answer: existing?.answer ?? "",
      });

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Player: Final Jeopardy Answer ─────────────────────────────────
    socket.on("player:final_answer", (data) => {
      const result = findGameBySocketId(socket.id);
      if (!result || result.isHost || !result.player) return;
      const { game, player } = result;

      if (
        game.status !== "final_jeopardy" ||
        game.finalJeopardy.state !== "answering"
      )
        return;

      const existing = game.finalJeopardy.submissions.get(player.id);
      game.finalJeopardy.submissions.set(player.id, {
        wager: existing?.wager ?? 0,
        answer: data.answer,
      });

      io.to(game.id).emit("game:state_sync", serializeGameState(game));
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      const result = findGameBySocketId(socket.id);
      if (!result) return;
      const { game } = result;

      // Clean up display socket
      if (result.isDisplay) {
        game.displaySocketIds.delete(socket.id);
        return;
      }

      if (!result.isHost && result.player) {
        result.player.isConnected = false;
        io.to(game.id).emit("game:player_left", {
          playerId: result.player.id,
        });
        io.to(game.id).emit("game:state_sync", serializeGameState(game));
      }
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getRandomPlayerId(game: Game): string | null {
  const connected = [...game.players.values()].filter(
    (p) => p.isConnected
  );
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)].id;
}

function findSocketById(
  io: TypedServer,
  socketId: string
): TypedSocket | undefined {
  return io.sockets.sockets.get(socketId) as TypedSocket | undefined;
}
