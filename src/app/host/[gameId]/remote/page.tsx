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

export default function HostRemotePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { socket, isConnected } = useSocket();
  const { gameState, lastFinalResult, buzzCountdown } = useGameState(socket);
  const [correctResponse, setCorrectResponse] = useState<string | null>(null);
  const [activeClueText, setActiveClueText] = useState<string | null>(null);
  const [activeClueValue, setActiveClueValue] = useState<number>(0);
  const [activeClueIsDD, setActiveClueIsDD] = useState(false);

  // Join game room as host controller
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("host:create_game", { gameId });

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

  // ── Loading ──────────────────────────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-screen bg-jeopardy-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-jeopardy-gold border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white text-base">
            {isConnected ? "Loading game..." : "Connecting..."}
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

  // ── Finished ─────────────────────────────────────────────────
  if (gameState.status === "finished") {
    return (
      <FinalJeopardy
        state="results"
        category=""
        clueText=""
        isHost={true}
        players={gameState.players}
        submissions={{}}
      />
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
    <div className="min-h-screen bg-jeopardy-blue flex flex-col">
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
            onJudge={handleJudge}
            onSkip={handleSkip}
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
              className="w-full py-3 bg-jeopardy-gold text-jeopardy-category font-bold text-lg rounded-xl hover:brightness-110 active:scale-95 transition-all animate-pulse"
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
