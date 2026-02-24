"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useGameState } from "@/hooks/useGameState";
import Board from "@/components/Board";
import ClueOverlay from "@/components/ClueOverlay";
import Scoreboard from "@/components/Scoreboard";
import DisplayLobby from "@/components/DisplayLobby";
import FinalJeopardy from "@/components/FinalJeopardy";
import QRCodeDisplay from "@/components/QRCode";
import { LOADING_MESSAGES } from "@/lib/constants";

export default function DisplayPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { socket, isConnected } = useSocket();
  const { gameState, lastFinalResult, buzzCountdown, isNewRoundLoading } = useGameState(socket);
  const [activeClueText, setActiveClueText] = useState<string | null>(null);
  const [activeClueValue, setActiveClueValue] = useState<number>(0);
  const [activeClueIsDD, setActiveClueIsDD] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [showJoinQR, setShowJoinQR] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotating loading messages for new round
  useEffect(() => {
    if (!isNewRoundLoading) return;
    setMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isNewRoundLoading]);

  // Join game room as display (passive viewer)
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("[display] emitting display:join for game:", gameId);
    socket.emit("display:join", { gameId });

    // Listen for errors
    socket.on("game:error", (data) => {
      console.error("[display] game:error:", data.message);
      setSocketError(data.message);
    });

    // Listen for clue selection to store clue text
    socket.on("game:clue_selected", (data) => {
      setActiveClueText(data.clueText);
      setActiveClueValue(data.value);
      setActiveClueIsDD(data.isDailyDouble);
    });

    // Clear when clue completes
    socket.on("game:clue_complete", () => {
      setActiveClueText(null);
    });

    return () => {
      socket.off("game:error");
      socket.off("game:clue_selected");
      socket.off("game:clue_complete");
    };
  }, [socket, isConnected, gameId]);

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
              <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-text-secondary text-lg">
                {isConnected ? "Loading game..." : "Connecting..."}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // New Round Loading
  if (isNewRoundLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-6" />
          <p
            key={messageIndex}
            className="text-text-secondary text-xl animate-[fadeIn_0.5s_ease-in] min-h-[3.5rem]"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    );
  }

  // Lobby — display-only (no Start button)
  if (gameState.status === "lobby") {
    return (
      <DisplayLobby
        gameId={gameId}
        players={gameState.players}
      />
    );
  }

  // Join Round overlay — reusable across active/final/finished states
  const joinRoundOverlay = (
    <>
      {/* Game code badge — top-left */}
      <div className="absolute top-4 left-4 z-40 px-3 py-1.5 bg-surface border border-border rounded-lg">
        <span className="text-text-secondary text-xs uppercase tracking-wider">Code: </span>
        <span className="text-accent font-bold text-sm tracking-widest">{gameId}</span>
      </div>

      {/* Join Round button — top-right */}
      <button
        onClick={() => setShowJoinQR(true)}
        className="absolute top-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-lg transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 17h3v3h-3zM14 14h3v3h-3z" />
        </svg>
        <span className="text-text-secondary text-sm font-medium">Join Round</span>
      </button>

      {/* Join Round QR Modal */}
      {showJoinQR && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowJoinQR(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-text-primary text-2xl font-bold mb-2">Join Game</h3>
            <p className="text-text-secondary text-sm mb-4">Scan to join mid-game</p>
            <p className="text-gradient-accent text-4xl font-bold tracking-[0.2em] mb-4">{gameId}</p>
            <QRCodeDisplay gameId={gameId} />
            <button
              onClick={() => setShowJoinQR(false)}
              className="mt-6 w-full py-3 bg-surface hover:bg-surface-hover text-text-primary font-bold rounded-lg transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );

  // Final Jeopardy — display-only (no controls, no answer)
  if (
    gameState.status === "final_jeopardy" ||
    gameState.finalJeopardy.state !== "not_started"
  ) {
    return (
      <div className="relative">
        {joinRoundOverlay}
        <FinalJeopardy
          state={gameState.finalJeopardy.state}
          category={gameState.finalJeopardy.category}
          clueText={gameState.finalJeopardy.clueText}
          isHost={false}
          players={gameState.players}
          submissions={gameState.finalJeopardy.submissions}
          lastFinalResult={lastFinalResult}
        />
      </div>
    );
  }

  // Finished
  if (gameState.status === "finished") {
    return (
      <div className="relative">
        {joinRoundOverlay}
        <FinalJeopardy
          state="results"
          category=""
          clueText=""
          isHost={false}
          players={gameState.players}
          submissions={{}}
        />
      </div>
    );
  }

  // Get answering player name
  const answeringPlayerName = gameState.currentClue?.answeringPlayerId
    ? gameState.players.find(
        (p) => p.id === gameState.currentClue?.answeringPlayerId
      )?.name
    : undefined;

  // Daily Double player name
  const ddPlayerName =
    gameState.currentClue?.state === "daily_double_wager" &&
    gameState.currentClue.answeringPlayerId
      ? gameState.players.find(
          (p) => p.id === gameState.currentClue?.answeringPlayerId
        )?.name
      : undefined;

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {joinRoundOverlay}

      {/* Board — always disabled (display-only) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Board
          board={gameState.board}
          onSelectClue={() => {}}
          disabled={true}
        />
      </div>

      {/* Scoreboard */}
      <div className="p-4">
        <Scoreboard
          players={gameState.players}
          activePlayerId={gameState.currentClue?.answeringPlayerId}
        />
      </div>

      {/* Clue Overlay — no answer, no controls */}
      {gameState.currentClue && activeClueText && (
        <ClueOverlay
          clueText={activeClueText}
          value={activeClueValue}
          clueState={gameState.currentClue.state}
          answeringPlayerName={answeringPlayerName}
          isDailyDouble={activeClueIsDD}
          dailyDoublePlayerName={ddPlayerName}
          buzzCountdown={buzzCountdown}
        />
      )}
    </div>
  );
}
