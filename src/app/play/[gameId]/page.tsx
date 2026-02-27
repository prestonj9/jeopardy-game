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
import InteractiveHero from "@/components/InteractiveHero";
import { LOADING_MESSAGES } from "@/lib/constants";

export default function PlayerGamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const playerName = searchParams.get("name") || "Player";
  const { socket, isConnected } = useSocket();
  const { gameState, lastJudgeResult, lastFinalResult, buzzCountdown, countdownType, countdownTotalSeconds, isNewRoundLoading, revealedAnswer } =
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-danger text-xl mb-4">{joinError}</p>
          <a
            href="/play"
            className="text-accent underline hover:opacity-80"
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary text-lg">Joining game...</p>
        </div>
      </div>
    );
  }

  // New Round Loading
  if (isNewRoundLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center p-4 relative overflow-hidden">
        <InteractiveHero />
        <div className="text-center max-w-sm relative z-10">
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

  // Lobby
  if (gameState.status === "lobby") {
    return (
      <Lobby
        gameId={gameId}
        players={gameState.players}
        isHost={false}
        boardStatus={gameState.boardStatus}
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
        countdown={countdownType === "final_answer" ? buzzCountdown : null}
        countdownTotal={countdownType === "final_answer" ? countdownTotalSeconds : null}
        revealOrder={gameState.finalJeopardy.revealOrder}
        currentRevealIndex={gameState.finalJeopardy.currentRevealIndex}
        currentRevealStep={gameState.finalJeopardy.currentRevealStep}
        judgments={gameState.finalJeopardy.judgments}
        preRevealScores={gameState.finalJeopardy.preRevealScores}
      />
    );
  }

  // Finished
  if (gameState.status === "finished") {
    return (
      <FinalJeopardy
        state="winner"
        category=""
        clueText=""
        isHost={false}
        players={gameState.players}
        myPlayerId={playerId}
        submissions={{}}
        revealOrder={[]}
        currentRevealIndex={-1}
        currentRevealStep="focus"
        judgments={{}}
        preRevealScores={{}}
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
  const isRapidFire = gameState.gameMode === "rapid_fire";

  const answeringPlayerName = currentClue?.answeringPlayerId
    ? gameState.players.find((p) => p.id === currentClue.answeringPlayerId)?.name
    : undefined;
  const someoneElseAnswering =
    currentClue?.state === "player_answering" && !isAnswering;

  // Determine buzz button state
  let buzzState: "disabled" | "active" | "buzzed" | "won" | "locked_out" = "disabled";
  if (currentClue) {
    if (isAnswering && currentClue.state === "player_answering") {
      buzzState = "won";
    } else if (isLockedOut) {
      buzzState = "locked_out";
    } else if (hasBuzzed) {
      buzzState = "buzzed";
    } else if (currentClue.state === "buzzing_open") {
      buzzState = "active";
    }
  }

  return (
    <div
      className="min-h-[100dvh] bg-white flex flex-col"
      style={{ overscrollBehavior: "none" }}
    >
      {/* Header with score */}
      <div className="px-4 py-3 bg-surface border-b border-border flex justify-between items-center">
        <span className="text-text-primary font-bold">{myPlayer?.name}</span>
        <div className="flex items-center gap-3">
          {isRapidFire && gameState.currentClueIndex >= 0 && (
            <span className="text-text-tertiary text-xs">
              {gameState.currentClueIndex + 1}/{gameState.totalClues}
            </span>
          )}
          <span
            className={`font-bold text-xl ${
              (myPlayer?.score ?? 0) < 0 ? "text-danger" : "text-accent"
            }`}
          >
            ${(myPlayer?.score ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* No active clue */}
        {!currentClue && (
          <div className="text-center">
            <p className="text-text-secondary text-lg">
              {isRapidFire
                ? gameState.currentClueIndex === -1
                  ? "Get ready — Rapid Fire!"
                  : "Waiting for next clue..."
                : "Waiting for host to select a clue..."}
            </p>
          </div>
        )}

        {/* Daily Double wager (for designated player) */}
        {isDDForMe && showDDWager && myPlayer && (
          <div className="w-full max-w-sm">
            <h2 className="text-3xl font-bold text-gradient-accent text-center mb-4 animate-gradient-reveal">
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
            <h2 className="text-3xl font-bold text-gradient-accent mb-2">
              DAILY DOUBLE!
            </h2>
            <p className="text-text-secondary">
              Another player is wagering...
            </p>
          </div>
        )}

        {/* Active clue with buzz */}
        {currentClue && !isDDWagerPhase && activeClueText && (
          <div className="w-full max-w-md text-center">
            {/* Clue value */}
            <div className="mb-2">
              <span className="text-gradient-accent font-bold text-lg">
                ${activeClueValue}
              </span>
            </div>

            {/* Clue text */}
            <p className="text-text-primary text-xl md:text-2xl font-medium leading-relaxed mb-8">
              {activeClueText}
            </p>

            {/* Judge result flash */}
            {lastJudgeResult && currentClue.state !== "buzzing_open" && (
              <div
                className={`mb-4 p-3 rounded-lg font-bold text-lg ${
                  lastJudgeResult.correct
                    ? "bg-success/10 text-success animate-flash-green"
                    : "bg-danger/10 text-danger animate-flash-red"
                }`}
              >
                {lastJudgeResult.correct ? "Correct!" : "Incorrect"}
              </div>
            )}

            {/* Revealed answer */}
            {currentClue.state === "answer_revealed" && revealedAnswer && (
              <div className="mb-4 p-4 bg-accent/10 rounded-xl border-2 border-accent/30">
                <p className="text-accent/70 text-xs uppercase tracking-wider mb-1">
                  Correct Response
                </p>
                <p className="text-accent text-2xl font-bold">
                  {revealedAnswer}
                </p>
              </div>
            )}

            {/* No one answered indicator */}
            {currentClue.state === "awaiting_reveal" && (
              <div className="mb-4 p-3 rounded-lg font-bold text-lg text-text-secondary">
                No one answered
              </div>
            )}

            {/* Who buzzed in — shown to other players */}
            {someoneElseAnswering && answeringPlayerName && (
              <div className="mb-4 animate-buzz-in-reveal">
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-1">
                  Answering
                </p>
                <p className="text-text-primary text-2xl font-bold">
                  {answeringPlayerName}
                </p>
                {buzzCountdown !== null && buzzCountdown > 0 && countdownTotalSeconds && (
                  <div className="mt-3 w-full h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warning rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(buzzCountdown / countdownTotalSeconds) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Buzz button — hide during reveal states */}
            {currentClue.state !== "awaiting_reveal" && currentClue.state !== "answer_revealed" && (
              <BuzzButton state={buzzState} onBuzz={handleBuzz} countdown={buzzCountdown} countdownTotalSeconds={countdownTotalSeconds} />
            )}
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
