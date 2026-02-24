"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useGameState } from "@/hooks/useGameState";
import Lobby from "@/components/Lobby";
import BuzzButton from "@/components/BuzzButton";
import Scoreboard from "@/components/Scoreboard";
import WagerInput from "@/components/WagerInput";
import FinalJeopardy from "@/components/FinalJeopardy";
import { LOADING_MESSAGES } from "@/lib/constants";

export default function PlayerGamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const playerName = searchParams.get("name") || "Player";
  const { socket, isConnected } = useSocket();
  const { gameState, lastJudgeResult, lastCorrectResponse, lastFinalResult, buzzCountdown, isNewRoundLoading } =
    useGameState(socket);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [activeClueText, setActiveClueText] = useState<string | null>(null);
  const [activeClueValue, setActiveClueValue] = useState<number>(0);
  const [showDDWager, setShowDDWager] = useState(false);
  const [ddMaxWager, setDDMaxWager] = useState(1000);
  const [messageIndex, setMessageIndex] = useState(0);

  // Join game (first time only)
  useEffect(() => {
    if (!socket || !isConnected || playerId) return;

    socket.emit(
      "player:join",
      { gameId, playerName },
      (result) => {
        if (result.success && result.playerId) {
          setPlayerId(result.playerId);
          // Store for reconnection
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("jeopardy_gameId", gameId);
            sessionStorage.setItem("jeopardy_playerName", playerName);
            sessionStorage.setItem("jeopardy_playerId", result.playerId);
          }
        } else {
          setJoinError(result.error || "Failed to join");
        }
      }
    );
  }, [socket, isConnected, gameId, playerName, playerId]);

  // Reconnect after phone sleep / network drop
  useEffect(() => {
    if (!socket || !playerId) return;

    const handleReconnect = () => {
      console.log("[player] socket reconnected, re-joining game:", gameId);
      socket.emit(
        "player:join",
        { gameId, playerName },
        (result) => {
          if (result.success) {
            console.log("[player] reconnect successful");
          } else {
            console.error("[player] reconnect failed:", result.error);
          }
        }
      );
    };

    socket.io.on("reconnect", handleReconnect);
    return () => {
      socket.io.off("reconnect", handleReconnect);
    };
  }, [socket, playerId, gameId, playerName]);

  // Listen for clue events
  useEffect(() => {
    if (!socket) return;

    socket.on("game:clue_selected", (data) => {
      setActiveClueText(data.clueText);
      setActiveClueValue(data.value);
      setHasBuzzed(false);
    });

    socket.on("game:clue_complete", () => {
      setActiveClueText(null);
      setHasBuzzed(false);
    });

    socket.on("game:buzzing_open", () => {
      setHasBuzzed(false);
    });

    socket.on("game:daily_double_wager_prompt", (data) => {
      setShowDDWager(true);
      setDDMaxWager(data.maxWager);
    });

    return () => {
      socket.off("game:clue_selected");
      socket.off("game:clue_complete");
      socket.off("game:buzzing_open");
      socket.off("game:daily_double_wager_prompt");
    };
  }, [socket]);

  // Reset buzz state when buzzing reopens after incorrect
  useEffect(() => {
    if (gameState?.currentClue?.state === "buzzing_open") {
      // Only reset if we haven't been locked out
      if (
        playerId &&
        !gameState.currentClue.playersWhoAttempted.includes(playerId)
      ) {
        setHasBuzzed(false);
      }
    }
  }, [gameState?.currentClue?.state, gameState?.currentClue?.playersWhoAttempted, playerId]);

  // Reset local state when a new round starts
  useEffect(() => {
    if (gameState?.status === "active" && !gameState.currentClue) {
      setHasBuzzed(false);
      setActiveClueText(null);
      setShowDDWager(false);
    }
  }, [gameState?.status, gameState?.currentClue]);

  // Rotating loading messages for new round
  useEffect(() => {
    if (!isNewRoundLoading) return;
    setMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isNewRoundLoading]);

  const handleBuzz = useCallback(() => {
    if (!socket || hasBuzzed) return;
    socket.emit("player:buzz");
    setHasBuzzed(true);
  }, [socket, hasBuzzed]);

  const handleDDWager = useCallback(
    (amount: number) => {
      socket?.emit("player:daily_double_wager", { amount });
      setShowDDWager(false);
    },
    [socket]
  );

  const handleFinalWager = useCallback(
    (amount: number) => {
      socket?.emit("player:final_wager", { amount });
    },
    [socket]
  );

  const handleFinalAnswer = useCallback(
    (answer: string) => {
      socket?.emit("player:final_answer", { answer });
    },
    [socket]
  );

  // Error state
  if (joinError) {
    return (
      <div className="min-h-screen bg-jeopardy-blue flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{joinError}</p>
          <a
            href="/play"
            className="text-jeopardy-gold underline hover:brightness-110"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  // Loading
  if (!gameState || !playerId) {
    return (
      <div className="min-h-screen bg-jeopardy-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-jeopardy-gold border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white text-lg">Joining game...</p>
        </div>
      </div>
    );
  }

  // New Round Loading
  if (isNewRoundLoading) {
    return (
      <div className="min-h-[100dvh] bg-jeopardy-blue flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="animate-spin w-10 h-10 border-4 border-jeopardy-gold border-t-transparent rounded-full mx-auto mb-6" />
          <p
            key={messageIndex}
            className="text-white text-lg animate-[fadeIn_0.5s_ease-in] min-h-[3rem]"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    );
  }

  // Lobby
  if (gameState.status === "lobby") {
    return (
      <Lobby
        gameId={gameId}
        players={gameState.players}
        isHost={false}
      />
    );
  }

  // Final Jeopardy
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
        myPlayerId={playerId}
        submissions={gameState.finalJeopardy.submissions}
        onSubmitWager={handleFinalWager}
        onSubmitAnswer={handleFinalAnswer}
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
        myPlayerId={playerId}
        submissions={{}}
      />
    );
  }

  // Active game
  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const currentClue = gameState.currentClue;
  const isLockedOut = currentClue?.playersWhoAttempted.includes(playerId) ?? false;
  const isAnswering = currentClue?.answeringPlayerId === playerId;
  const isDDWagerPhase = currentClue?.state === "daily_double_wager";
  const isDDForMe = isDDWagerPhase && currentClue?.answeringPlayerId === playerId;

  // Determine buzz button state
  let buzzState: "disabled" | "active" | "buzzed" | "locked_out" = "disabled";
  if (currentClue) {
    if (isLockedOut) {
      buzzState = "locked_out";
    } else if (hasBuzzed || isAnswering) {
      buzzState = "buzzed";
    } else if (currentClue.state === "buzzing_open") {
      buzzState = "active";
    }
  }

  return (
    <div
      className="min-h-[100dvh] bg-jeopardy-blue flex flex-col"
      style={{ overscrollBehavior: "none" }}
    >
      {/* Header with score */}
      <div className="px-4 py-3 bg-jeopardy-category flex justify-between items-center">
        <span className="text-white font-bold">{myPlayer?.name}</span>
        <span
          className={`font-bold text-xl ${
            (myPlayer?.score ?? 0) < 0 ? "text-red-400" : "text-jeopardy-gold"
          }`}
        >
          ${(myPlayer?.score ?? 0).toLocaleString()}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* No active clue */}
        {!currentClue && (
          <div className="text-center">
            <p className="text-white/60 text-lg">
              Waiting for host to select a clue...
            </p>
            {lastCorrectResponse && (
              <div className="mt-4 p-4 bg-white/5 rounded-lg">
                <p className="text-jeopardy-gold font-bold">
                  {lastCorrectResponse}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Daily Double wager (for designated player) */}
        {isDDForMe && showDDWager && myPlayer && (
          <div className="w-full max-w-sm">
            <h2 className="text-3xl font-bold text-jeopardy-gold text-center mb-4 animate-pulse">
              DAILY DOUBLE!
            </h2>
            <WagerInput
              maxWager={ddMaxWager}
              playerScore={myPlayer.score}
              onSubmit={handleDDWager}
            />
          </div>
        )}

        {/* Daily Double waiting (for other players) */}
        {isDDWagerPhase && !isDDForMe && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-jeopardy-gold mb-2">
              DAILY DOUBLE!
            </h2>
            <p className="text-white/60">
              Another player is wagering...
            </p>
          </div>
        )}

        {/* Active clue with buzz */}
        {currentClue && !isDDWagerPhase && activeClueText && (
          <div className="w-full max-w-md text-center">
            {/* Clue value */}
            <div className="mb-2">
              <span className="text-jeopardy-gold font-bold text-lg">
                ${activeClueValue}
              </span>
            </div>

            {/* Clue text */}
            <p className="text-white text-xl md:text-2xl font-medium leading-relaxed mb-8">
              {activeClueText}
            </p>

            {/* Judge result flash */}
            {lastJudgeResult && currentClue.state !== "buzzing_open" && (
              <div
                className={`mb-4 p-3 rounded-lg font-bold text-lg ${
                  lastJudgeResult.correct
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {lastJudgeResult.correct ? "Correct!" : "Incorrect"}
              </div>
            )}

            {/* Buzz button */}
            <BuzzButton state={buzzState} onBuzz={handleBuzz} countdown={buzzCountdown} />
          </div>
        )}
      </div>

      {/* Mini scoreboard */}
      <div className="p-4">
        <Scoreboard
          players={gameState.players}
          activePlayerId={currentClue?.answeringPlayerId}
        />
      </div>
    </div>
  );
}
