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

export default function DisplayPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { socket, isConnected } = useSocket();
  const { gameState, lastFinalResult, buzzCountdown } = useGameState(socket);
  const [activeClueText, setActiveClueText] = useState<string | null>(null);
  const [activeClueValue, setActiveClueValue] = useState<number>(0);
  const [activeClueIsDD, setActiveClueIsDD] = useState(false);

  // Join game room as display (passive viewer)
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("display:join", { gameId });

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
      socket.off("game:clue_selected");
      socket.off("game:clue_complete");
    };
  }, [socket, isConnected, gameId]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-jeopardy-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-jeopardy-gold border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white text-lg">
            {isConnected ? "Loading game..." : "Connecting..."}
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

  // Final Jeopardy — display-only (no controls, no answer)
  if (
    gameState.status === "final_jeopardy" ||
    gameState.finalJeopardy.state !== "not_started"
  ) {
    return (
      <FinalJeopardy
        state={gameState.finalJeopardy.state}
        category={gameState.finalJeopardy.category}
        clueText={gameState.finalJeopardy.clueText}
        isHost={false}
        players={gameState.players}
        submissions={gameState.finalJeopardy.submissions}
        lastFinalResult={lastFinalResult}
      />
    );
  }

  // Finished
  if (gameState.status === "finished") {
    return (
      <FinalJeopardy
        state="results"
        category=""
        clueText=""
        isHost={false}
        players={gameState.players}
        submissions={{}}
      />
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
    <div className="min-h-screen bg-jeopardy-blue flex flex-col">
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
