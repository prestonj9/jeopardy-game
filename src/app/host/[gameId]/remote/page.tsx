"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useGameState } from "@/hooks/useGameState";
import MiniBoard from "@/components/MiniBoard";
import RemoteClueView from "@/components/RemoteClueView";
import Scoreboard from "@/components/Scoreboard";
import Lobby from "@/components/Lobby";
import FinalJeopardy from "@/components/FinalJeopardy";
import { LOADING_MESSAGES } from "@/lib/constants";

export default function HostRemotePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { socket, isConnected } = useSocket();
  const { gameState, lastFinalResult, buzzCountdown, countdownType, countdownTotalSeconds, isNewRoundLoading } = useGameState(socket);
  const [correctResponse, setCorrectResponse] = useState<string | null>(null);
  const [activeClueText, setActiveClueText] = useState<string | null>(null);
  const [activeClueValue, setActiveClueValue] = useState<number>(0);
  const [activeClueIsDD, setActiveClueIsDD] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [newRoundTopic, setNewRoundTopic] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);

  // Join game room as host controller
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("[remote] emitting host:create_game for game:", gameId);
    socket.emit("host:create_game", { gameId });

    // Listen for errors
    socket.on("game:error", (data) => {
      console.error("[remote] game:error:", data.message);
      setSocketError(data.message);
    });

    // Listen for host-only answer reveals
    socket.on("game:host_clue_answer", (data) => {
      setCorrectResponse(data.correctResponse);
    });

    // Listen for clue selection to store clue text
    socket.on("game:clue_selected", (data) => {
      setActiveClueText(data.clueText);
      setActiveClueValue(data.value);
      setActiveClueIsDD(data.isDailyDouble);
    });

    // Clear when clue completes
    socket.on("game:clue_complete", () => {
      setCorrectResponse(null);
      setActiveClueText(null);
    });

    return () => {
      socket.off("game:error");
      socket.off("game:host_clue_answer");
      socket.off("game:clue_selected");
      socket.off("game:clue_complete");
    };
  }, [socket, isConnected, gameId]);

  // ── Host action callbacks ────────────────────────────────────
  const handleSelectClue = useCallback(
    (categoryIndex: number, clueIndex: number) => {
      socket?.emit("host:select_clue", { categoryIndex, clueIndex });
    },
    [socket]
  );

  const handleStartGame = useCallback(() => {
    socket?.emit("host:start_game");
  }, [socket]);

  const handleJudge = useCallback(
    (correct: boolean) => {
      socket?.emit("host:judge", { correct });
    },
    [socket]
  );

  const handleSkip = useCallback(() => {
    socket?.emit("host:skip_clue");
  }, [socket]);

  const handleRevealAnswer = useCallback(() => {
    socket?.emit("host:reveal_answer");
  }, [socket]);

  const handleStartFinal = useCallback(() => {
    socket?.emit("host:start_final");
  }, [socket]);

  const handleAdvanceFinal = useCallback(() => {
    socket?.emit("host:advance_final");
  }, [socket]);

  const handleJudgeFinal = useCallback(
    (playerId: string, correct: boolean) => {
      socket?.emit("host:judge_final", { playerId, correct });
    },
    [socket]
  );

  const handleNewRound = useCallback(() => {
    if (!socket || !newRoundTopic.trim()) return;
    socket.emit("host:new_round", { topic: newRoundTopic.trim() });
  }, [socket, newRoundTopic]);

  // Reset local state when a new round starts
  useEffect(() => {
    if (gameState?.status === "active" && !gameState.currentClue) {
      setCorrectResponse(null);
      setActiveClueText(null);
      setNewRoundTopic("");
    }
  }, [gameState?.status, gameState?.currentClue]);

  // Rotating loading messages
  useEffect(() => {
    if (!isNewRoundLoading) return;
    setMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isNewRoundLoading]);

  // Haptic feedback when a player buzzes in
  useEffect(() => {
    if (gameState?.currentClue?.state === "player_answering") {
      navigator.vibrate?.([100, 50, 100]);
    }
  }, [gameState?.currentClue?.state]);

  // ── Loading ──────────────────────────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          {socketError ? (
            <>
              <p className="text-danger text-xl mb-4">{socketError}</p>
              <a href="/create" className="text-accent underline">Create a new game</a>
            </>
          ) : (
            <>
              <div className="animate-spin w-10 h-10 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-text-secondary text-base">
                {isConnected ? "Loading game..." : "Connecting..."}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── New Round Loading ───────────────────────────────────────
  if (isNewRoundLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="animate-spin w-10 h-10 border-4 border-accent border-t-transparent rounded-full mx-auto mb-6" />
          <p
            key={messageIndex}
            className="text-text-secondary text-lg animate-[fadeIn_0.5s_ease-in] min-h-[3rem]"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────
  if (gameState.status === "lobby") {
    return (
      <Lobby
        gameId={gameId}
        players={gameState.players}
        isHost={true}
        onStartGame={handleStartGame}
      />
    );
  }

  // ── Final Jeopardy ──────────────────────────────────────────
  if (
    gameState.status === "final_jeopardy" ||
    gameState.finalJeopardy.state !== "not_started"
  ) {
    return (
      <FinalJeopardy
        state={gameState.finalJeopardy.state}
        category={gameState.finalJeopardy.category}
        clueText={gameState.finalJeopardy.clueText}
        correctResponse={correctResponse || undefined}
        isHost={true}
        players={gameState.players}
        submissions={gameState.finalJeopardy.submissions}
        onAdvance={handleAdvanceFinal}
        onJudge={handleJudgeFinal}
        lastFinalResult={lastFinalResult}
      />
    );
  }

  // ── Finished — scores + new round form ──────────────────────
  if (gameState.status === "finished") {
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen bg-white flex flex-col items-center p-6 overflow-y-auto">
        {/* Final Scores */}
        <h2 className="text-3xl font-bold text-gradient-accent mb-6 mt-4">Final Scores</h2>
        <div className="w-full max-w-md space-y-2 mb-8">
          {sortedPlayers.map((player, i) => (
            <div
              key={player.id}
              className={`flex justify-between items-center px-4 py-3 rounded-xl ${
                i === 0
                  ? "bg-accent/10 ring-2 ring-accent"
                  : "bg-surface border border-border"
              }`}
            >
              <span className="text-text-primary font-bold">
                {i === 0 ? "🏆 " : `#${i + 1} `}
                {player.name}
              </span>
              <span
                className={`font-bold ${
                  player.score < 0 ? "text-danger" : "text-accent"
                }`}
              >
                ${player.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* New Round Form */}
        <div className="w-full max-w-md bg-surface rounded-2xl p-6 border border-border">
          <h3 className="text-xl font-bold text-text-primary mb-4 text-center">
            New Round
          </h3>
          <input
            type="text"
            value={newRoundTopic}
            onChange={(e) => setNewRoundTopic(e.target.value)}
            placeholder="Enter a topic..."
            maxLength={500}
            className="w-full px-4 py-3 rounded-lg bg-white border border-border text-text-primary placeholder-text-tertiary text-lg focus:outline-none focus:ring-2 focus:ring-accent mb-4"
          />
          <button
            onClick={handleNewRound}
            disabled={!newRoundTopic.trim()}
            className="w-full py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent-cyan text-white hover:opacity-90 active:scale-95"
          >
            Generate New Board
          </button>
        </div>
      </div>
    );
  }

  // ── Active game ──────────────────────────────────────────────
  const hasActiveClue = gameState.currentClue && activeClueText;
  const allCluesRevealed = gameState.board.categories.every((cat) =>
    cat.clues.every((clue) => clue.isRevealed)
  );

  // Get answering player name
  const answeringPlayerName = gameState.currentClue?.answeringPlayerId
    ? gameState.players.find(
        (p) => p.id === gameState.currentClue?.answeringPlayerId
      )?.name
    : undefined;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Active Clue View */}
      {hasActiveClue ? (
        <div className="flex-1">
          <RemoteClueView
            clueText={activeClueText!}
            value={activeClueValue}
            clueState={gameState.currentClue!.state}
            correctResponse={correctResponse}
            answeringPlayerName={answeringPlayerName}
            isDailyDouble={activeClueIsDD}
            buzzCountdown={buzzCountdown}
            countdownType={countdownType}
            countdownTotalSeconds={countdownTotalSeconds}
            onJudge={handleJudge}
            onSkip={handleSkip}
            onRevealAnswer={handleRevealAnswer}
          />
        </div>
      ) : (
        /* Mini Board for selecting clues */
        <div className="flex-1 flex flex-col p-3 gap-3">
          <MiniBoard
            board={gameState.board}
            onSelectClue={handleSelectClue}
            disabled={!!gameState.currentClue}
          />

          {/* Start Final Jeopardy button */}
          {allCluesRevealed && (
            <button
              onClick={handleStartFinal}
              className="w-full py-3 bg-gradient-to-r from-accent to-accent-cyan text-white font-bold text-lg rounded-xl hover:opacity-90 active:scale-95 transition-all animate-pulse"
            >
              Start Final Jeopardy
            </button>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div className="p-3 pb-safe">
        <Scoreboard
          players={gameState.players}
          activePlayerId={gameState.currentClue?.answeringPlayerId}
        />
      </div>
    </div>
  );
}
