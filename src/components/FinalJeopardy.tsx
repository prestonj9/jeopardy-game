"use client";

import { useState, useEffect, useRef } from "react";
import type { FinalState, RevealStep, SerializablePlayer } from "@/lib/types";
import WagerInput from "./WagerInput";

interface FinalJeopardyProps {
  state: FinalState;
  category: string;
  clueText: string;
  correctResponse?: string; // host only
  isHost: boolean;
  players: SerializablePlayer[];
  myPlayerId?: string;
  submissions: Record<string, { wager: number; answer: string }>;
  onAdvance?: () => void;
  onJudge?: (playerId: string, correct: boolean) => void;
  onSubmitWager?: (amount: number) => void;
  onSubmitAnswer?: (answer: string) => void;
  onRevealAdvance?: () => void;
  onNewRound?: (topic: string, resetScores: boolean) => void;
  onTapConfetti?: () => void;
  lastFinalResult?: {
    playerId: string;
    playerName: string;
    correct: boolean;
    wager: number;
    answer: string;
  } | null;
  countdown?: number | null;
  countdownTotal?: number | null;
  // Reveal state
  revealOrder: string[];
  currentRevealIndex: number;
  currentRevealStep: RevealStep;
  judgments: Record<string, boolean>;
  preRevealScores: Record<string, number>;
}

// Animated score counter component
function AnimatedScore({ from, to, active }: { from: number; to: number; active: boolean }) {
  const [display, setDisplay] = useState(from);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setDisplay(to);
      return;
    }
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [from, to, active]);

  return (
    <span className={`font-bold text-xl tabular-nums ${display < 0 ? "text-danger" : "text-accent"}`}>
      ${display.toLocaleString()}
    </span>
  );
}

// Confetti colors shared across components
const CONFETTI_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

// Confetti component — enhanced with more pieces, drift, and second wave
function Confetti() {
  const pieces = Array.from({ length: 120 }).map((_, i) => {
    const isSecondWave = i >= 80;
    const drift = (Math.random() - 0.5) * 60; // -30px to +30px
    return (
      <div
        key={i}
        className="absolute animate-confetti"
        style={{
          left: `${Math.random() * 100}%`,
          animationDelay: `${(isSecondWave ? 1.5 : 0) + Math.random() * 2}s`,
          animationDuration: `${2 + Math.random() * 3}s`,
          backgroundColor: CONFETTI_COLORS[i % 6],
          width: `${6 + Math.random() * 10}px`,
          height: `${6 + Math.random() * 10}px`,
          borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          "--drift": `${drift}px`,
        } as React.CSSProperties}
      />
    );
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {pieces}
    </div>
  );
}

export default function FinalJeopardy({
  state,
  category,
  clueText,
  correctResponse,
  isHost,
  players,
  myPlayerId,
  submissions,
  onAdvance,
  onJudge,
  onSubmitWager,
  onSubmitAnswer,
  onRevealAdvance,
  onNewRound,
  onTapConfetti,
  countdown,
  countdownTotal,
  revealOrder,
  currentRevealIndex,
  currentRevealStep,
  judgments,
  preRevealScores,
}: FinalJeopardyProps) {
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [submittedWager, setSubmittedWager] = useState(false);
  const [showNewRoundForm, setShowNewRoundForm] = useState(false);
  const [confettiTaps, setConfettiTaps] = useState(0);
  const [newRoundTopic, setNewRoundTopic] = useState("");
  const [resetScores, setResetScores] = useState(false);

  const myPlayer = players.find((p) => p.id === myPlayerId);

  // Helper: get player by ID
  const getPlayer = (id: string) => players.find((p) => p.id === id);

  // Current reveal player
  const currentRevealPlayerId = currentRevealIndex >= 0 ? revealOrder[currentRevealIndex] : null;
  const currentRevealPlayer = currentRevealPlayerId ? getPlayer(currentRevealPlayerId) : null;

  // Is a specific player the active reveal target?
  const isActiveReveal = (playerId: string) => {
    return currentRevealPlayerId === playerId && currentRevealIndex >= 0;
  };

  // Get the reveal step for a specific player
  const getPlayerRevealStep = (playerId: string): RevealStep | "unrevealed" | "done" => {
    const playerIdx = revealOrder.indexOf(playerId);
    if (playerIdx < 0) return "unrevealed";
    if (playerIdx < currentRevealIndex) return "done";
    if (playerIdx === currentRevealIndex) return currentRevealStep;
    return "unrevealed";
  };

  // Has a player's answer step been reached or passed?
  const isAnswerShown = (playerId: string) => {
    const step = getPlayerRevealStep(playerId);
    return step === "answer" || step === "judged" || step === "wager" || step === "score" || step === "done";
  };

  // Has a player been judged?
  const isJudged = (playerId: string) => {
    return judgments[playerId] !== undefined;
  };

  // Has wager been shown?
  const isWagerShown = (playerId: string) => {
    const step = getPlayerRevealStep(playerId);
    return step === "wager" || step === "score" || step === "done";
  };

  // Has score been updated?
  const isScoreRevealed = (playerId: string) => {
    const step = getPlayerRevealStep(playerId);
    return step === "score" || step === "done";
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Show Category */}
      {state === "show_category" && (
        <div className="text-center">
          <p className="text-text-secondary text-sm uppercase tracking-wider mb-2">
            Final Jeopardy Category
          </p>
          <h2 className="text-4xl md:text-6xl font-bold text-gradient-accent">
            {category}
          </h2>
          {isHost && (
            <button
              onClick={onAdvance}
              className="mt-8 px-8 py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
            >
              Begin Wagering
            </button>
          )}
        </div>
      )}

      {/* Wagering */}
      {state === "wagering" && (
        <div className="text-center w-full max-w-md">
          <h2 className="text-3xl font-bold text-gradient-accent mb-2">
            {category}
          </h2>
          {isHost ? (
            <div>
              <p className="text-text-primary text-lg mb-4">
                Waiting for wagers...
              </p>
              <div className="space-y-2 mb-6">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center px-4 py-2 bg-surface rounded-xl border border-border"
                  >
                    <span className="text-text-primary">{p.name}</span>
                    <span className="text-accent">
                      {submissions[p.id]
                        ? "Wager submitted"
                        : "Waiting..."}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onAdvance}
                className="px-8 py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
              >
                Show Clue
              </button>
            </div>
          ) : !submittedWager && myPlayer ? (
            <WagerInput
              maxWager={Math.max(myPlayer.score, 0)}
              minWager={0}
              playerScore={myPlayer.score}
              onSubmit={(amount) => {
                onSubmitWager?.(amount);
                setSubmittedWager(true);
              }}
              label="How much will you wager?"
            />
          ) : (
            <p className="text-text-primary text-lg">
              Wager submitted! Waiting for other players...
            </p>
          )}
        </div>
      )}

      {/* Answering */}
      {state === "answering" && (
        <div className="text-center w-full max-w-2xl">
          <p className="text-text-secondary text-sm uppercase tracking-wider mb-2">
            {category}
          </p>
          <p className="text-text-primary text-2xl md:text-4xl font-medium leading-relaxed mb-8">
            {clueText}
          </p>

          {countdown != null && countdownTotal != null && (
            <div className="max-w-md mx-auto mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className={`text-2xl font-bold tabular-nums ${countdown <= 5 ? "text-danger" : "text-accent"}`}>
                  {countdown}s
                </span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${countdown <= 5 ? "bg-danger" : "bg-accent"}`}
                  style={{ width: `${(countdown / countdownTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          {isHost && correctResponse && (
            <div className="max-w-xl mx-auto mb-6 p-4 border-2 border-accent/30 rounded-xl bg-accent/5">
              <p className="text-accent/70 text-xs uppercase tracking-wider mb-1">
                Answer
              </p>
              <p className="text-accent text-xl font-bold">
                {correctResponse}
              </p>
            </div>
          )}

          {isHost ? (
            <div>
              <div className="space-y-2 mb-6">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center px-4 py-2 bg-surface rounded-xl border border-border"
                  >
                    <span className="text-text-primary">{p.name}</span>
                    <span className="text-accent">
                      {submissions[p.id]?.answer
                        ? "Answer submitted"
                        : "Writing..."}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onAdvance}
                className="px-8 py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
              >
                Begin Reveal
              </button>
            </div>
          ) : !submittedAnswer ? (
            <div className="max-w-md mx-auto">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="What is..."
                className="w-full px-5 py-3 text-xl bg-white/50 border border-white/60 rounded-full text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent mb-4"
              />
              <button
                onClick={() => {
                  onSubmitAnswer?.(answer);
                  setSubmittedAnswer(true);
                }}
                disabled={!answer.trim()}
                className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90 disabled:opacity-40"
              >
                Submit Answer
              </button>
            </div>
          ) : (
            <p className="text-text-primary text-lg">
              Answer submitted! Waiting for results...
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REVEALING — Display & Player Card Layout
          ═══════════════════════════════════════════════════════════════════ */}
      {state === "revealing" && !isHost && (
        <div className="w-full max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gradient-accent text-center mb-8">
            Final Jeopardy
          </h2>

          {/* Pre-reveal: waiting for host */}
          {currentRevealIndex === -1 && (
            <p className="text-text-secondary text-center text-lg animate-pulse">
              Waiting for the host to begin the reveal...
            </p>
          )}

          {/* Card grid */}
          {currentRevealIndex >= 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {revealOrder.map((playerId) => {
                const player = getPlayer(playerId);
                if (!player) return null;
                const isActive = isActiveReveal(playerId);
                const step = getPlayerRevealStep(playerId);
                const isMe = playerId === myPlayerId;
                const sub = submissions[playerId];
                const judged = judgments[playerId];
                const preScore = preRevealScores[playerId] ?? 0;
                const scoreRevealed = isScoreRevealed(playerId);

                return (
                  <div
                    key={playerId}
                    className={`
                      relative rounded-2xl border-2 p-5 transition-all duration-500 w-full sm:w-64
                      ${isActive
                        ? "border-accent bg-accent/5 scale-105 shadow-lg animate-card-focus"
                        : step === "done"
                          ? "border-border bg-surface"
                          : "border-border/50 bg-surface/50 opacity-60"
                      }
                    `}
                  >
                    {/* Player name */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-text-primary font-bold text-lg">
                        {player.name}
                      </span>
                      {isMe && isActive && (
                        <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full animate-pulse">
                          You&apos;re up!
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div className="mb-3">
                      {scoreRevealed ? (
                        <AnimatedScore
                          from={preScore}
                          to={player.score}
                          active={step === "score"}
                        />
                      ) : (
                        <span className="font-bold text-xl tabular-nums text-accent">
                          ${preScore.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Answer — show on host, display, and for the player themselves */}
                    {isAnswerShown(playerId) && (
                      <div className="animate-fade-in">
                        {(isMe || isHost || !myPlayerId) ? (
                          <p className="text-text-primary text-sm mb-2 italic">
                            &quot;{sub?.answer || "(no answer)"}&quot;
                          </p>
                        ) : (
                          <p className="text-text-secondary text-sm mb-2 italic">
                            Answer revealed
                          </p>
                        )}
                      </div>
                    )}

                    {/* Judgment indicator */}
                    {isJudged(playerId) && (
                      <div className={`inline-flex items-center gap-1 text-sm font-bold mb-2 animate-fade-in ${
                        judged ? "text-success" : "text-danger"
                      }`}>
                        <span>{judged ? "\u2713 Correct" : "\u2717 Incorrect"}</span>
                      </div>
                    )}

                    {/* Wager */}
                    {isWagerShown(playerId) && (
                      <p className="text-text-secondary text-sm animate-fade-in">
                        Wagered: ${sub?.wager?.toLocaleString() ?? 0}
                      </p>
                    )}

                    {/* Flash overlay for judgment */}
                    {isActive && step === "judged" && (
                      <div className={`absolute inset-0 rounded-2xl pointer-events-none ${
                        judged ? "animate-flash-green" : "animate-flash-red"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REVEALING — Host Remote Controls
          ═══════════════════════════════════════════════════════════════════ */}
      {state === "revealing" && isHost && (
        <div className="w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gradient-accent mb-4">
            Reveal Answers
          </h2>

          {/* Correct response always visible for host */}
          {correctResponse && (
            <div className="mb-6 p-4 border-2 border-accent/30 rounded-xl bg-accent/5">
              <p className="text-accent/70 text-xs uppercase tracking-wider mb-1">
                Correct Response
              </p>
              <p className="text-accent text-xl font-bold">
                {correctResponse}
              </p>
            </div>
          )}

          {/* Pre-reveal */}
          {currentRevealIndex === -1 && (
            <button
              onClick={onRevealAdvance}
              className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90 animate-pulse"
            >
              Begin Reveal
            </button>
          )}

          {/* Active player info & controls */}
          {currentRevealIndex >= 0 && currentRevealPlayer && (
            <div>
              <div className="mb-4 p-4 bg-surface rounded-xl border border-border">
                <p className="text-text-secondary text-sm mb-1">Now revealing:</p>
                <p className="text-text-primary font-bold text-2xl">
                  {currentRevealPlayer.name}
                </p>
                <p className="text-accent text-sm">
                  Current score: ${(preRevealScores[currentRevealPlayerId!] ?? 0).toLocaleString()}
                </p>
              </div>

              {/* Step-specific controls */}
              {currentRevealStep === "focus" && (
                <button
                  onClick={onRevealAdvance}
                  className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
                >
                  Reveal Answer
                </button>
              )}

              {currentRevealStep === "answer" && (
                <div>
                  <div className="mb-4 p-3 bg-surface rounded-xl border border-border">
                    <p className="text-text-secondary text-xs mb-1">Their answer:</p>
                    <p className="text-text-primary text-lg font-medium italic">
                      &quot;{submissions[currentRevealPlayerId!]?.answer || "(no answer)"}&quot;
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => onJudge?.(currentRevealPlayerId!, true)}
                      className="flex-1 py-4 bg-success text-white font-bold text-xl rounded-full hover:opacity-90"
                    >
                      Correct
                    </button>
                    <button
                      onClick={() => onJudge?.(currentRevealPlayerId!, false)}
                      className="flex-1 py-4 bg-danger text-white font-bold text-xl rounded-full hover:opacity-90"
                    >
                      Incorrect
                    </button>
                  </div>
                </div>
              )}

              {currentRevealStep === "judged" && (
                <div>
                  <div className={`mb-4 p-3 rounded-xl text-white font-bold text-center ${
                    judgments[currentRevealPlayerId!] ? "bg-success" : "bg-danger"
                  }`}>
                    {judgments[currentRevealPlayerId!] ? "\u2713 Correct!" : "\u2717 Incorrect"}
                  </div>
                  <button
                    onClick={onRevealAdvance}
                    className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
                  >
                    Reveal Wager
                  </button>
                </div>
              )}

              {currentRevealStep === "wager" && (
                <div>
                  <div className="mb-4 p-3 bg-surface rounded-xl border border-border">
                    <p className="text-text-secondary text-xs mb-1">Wagered:</p>
                    <p className="text-accent text-2xl font-bold">
                      ${submissions[currentRevealPlayerId!]?.wager?.toLocaleString() ?? 0}
                    </p>
                  </div>
                  <button
                    onClick={onRevealAdvance}
                    className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
                  >
                    Reveal Score
                  </button>
                </div>
              )}

              {currentRevealStep === "score" && (
                <div>
                  <div className="mb-4 p-3 bg-surface rounded-xl border border-border">
                    <p className="text-text-secondary text-xs mb-1">New score:</p>
                    <p className={`text-2xl font-bold ${
                      currentRevealPlayer.score < 0 ? "text-danger" : "text-accent"
                    }`}>
                      ${currentRevealPlayer.score.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={onRevealAdvance}
                    className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90"
                  >
                    {currentRevealIndex < revealOrder.length - 1
                      ? "Next Player"
                      : "Reveal Winner"
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          WINNER CELEBRATION — Podium
          ═══════════════════════════════════════════════════════════════════ */}
      {state === "winner" && (() => {
        const sorted = [...players].sort((a, b) => b.score - a.score);
        const podiumPlayers = sorted.slice(0, 3);
        const restPlayers = sorted.slice(3);

        // Podium order: 2nd, 1st, 3rd (classic podium arrangement)
        const podiumOrder = podiumPlayers.length >= 3
          ? [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]]
          : podiumPlayers.length === 2
            ? [podiumPlayers[1], podiumPlayers[0]]
            : [podiumPlayers[0]];

        const podiumConfig: Record<number, { height: string; medal: string; delay: string; color: string; border: string; bg: string }> = {
          0: { height: "min-h-[200px]", medal: "\ud83e\udd47", delay: "0.6s", color: "text-amber-500", border: "border-amber-400", bg: "bg-amber-50" },
          1: { height: "min-h-[160px]", medal: "\ud83e\udd48", delay: "0.3s", color: "text-gray-400", border: "border-gray-300", bg: "bg-gray-50" },
          2: { height: "min-h-[130px]", medal: "\ud83e\udd49", delay: "0s", color: "text-amber-700", border: "border-amber-600/40", bg: "bg-amber-50/50" },
        };

        // Map podiumOrder back to their original rank (0=1st, 1=2nd, 2=3rd)
        const getRank = (player: typeof sorted[0]) => sorted.indexOf(player);

        return (
          <>
            <Confetti />
            <div className="w-full max-w-4xl text-center relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-gradient-accent mb-10 animate-fade-in">
                {isHost ? "We Have a Winner!" : "Final Results"}
              </h2>

              {/* Podium */}
              <div className={`flex items-end justify-center gap-3 md:gap-5 mb-8 ${podiumPlayers.length === 1 ? "px-20" : "px-4"}`}>
                {podiumOrder.map((player) => {
                  const rank = getRank(player);
                  const config = podiumConfig[rank];
                  const isFirst = rank === 0;

                  return (
                    <div
                      key={player.id}
                      className={`
                        flex-1 max-w-[200px] ${config.height} flex flex-col items-center justify-end
                        rounded-t-2xl border-2 border-b-0 ${config.border} ${config.bg}
                        p-4 pb-5 opacity-0 animate-podium-rise origin-bottom
                        ${isFirst ? "animate-winner-glow" : ""}
                      `}
                      style={{ animationDelay: config.delay, animationFillMode: "forwards" }}
                    >
                      <div className={`text-3xl md:text-4xl mb-1 ${isFirst ? "animate-bounce" : ""}`}>
                        {config.medal}
                      </div>
                      <p className="text-text-primary font-bold text-base md:text-lg truncate max-w-full mb-0.5">
                        {player.name}
                      </p>
                      {isFirst && (
                        <p className="text-accent/70 text-[10px] uppercase tracking-widest mb-1">
                          Champion
                        </p>
                      )}
                      <p className={`font-bold text-xl md:text-2xl tabular-nums ${
                        player.score < 0 ? "text-danger" : "text-accent"
                      }`}>
                        ${player.score.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Remaining players */}
              {restPlayers.length > 0 && (
                <div className="max-w-sm mx-auto space-y-1.5 mb-8 animate-fade-in" style={{ animationDelay: "0.9s", animationFillMode: "forwards", opacity: 0 }}>
                  {restPlayers.map((player, i) => (
                    <div
                      key={player.id}
                      className="flex justify-between items-center px-4 py-2 bg-surface/60 rounded-lg border border-border/50"
                    >
                      <span className="text-text-secondary text-sm font-medium">
                        #{i + 4} {player.name}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${
                        player.score < 0 ? "text-danger" : "text-text-primary"
                      }`}>
                        ${player.score.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isHost && !showNewRoundForm && (
                <div className="flex gap-3 justify-center animate-fade-in" style={{ animationDelay: "1s", animationFillMode: "forwards", opacity: 0 }}>
                  <button
                    onClick={() => setShowNewRoundForm(true)}
                    className="px-8 py-4 bg-gradient-to-r from-accent to-accent-cyan text-white font-bold text-xl rounded-full hover:opacity-90 transition-all"
                  >
                    New Round
                  </button>
                  <button
                    onClick={onAdvance}
                    className="px-8 py-4 bg-surface border-2 border-border text-text-primary font-bold text-xl rounded-full hover:bg-surface-hover transition-all"
                  >
                    Finish Game
                  </button>
                </div>
              )}

              {/* Player tap-to-celebrate */}
              {!isHost && onTapConfetti && (
                <button
                  onClick={() => {
                    onTapConfetti();
                    setConfettiTaps((t) => t + 1);
                    navigator.vibrate?.(50);
                  }}
                  className="animate-fade-in active:scale-95 transition-transform"
                  style={{ animationDelay: "1s", animationFillMode: "forwards", opacity: 0 }}
                >
                  <span className="text-2xl">
                    {confettiTaps === 0 ? "🎉 Tap to celebrate!" : `🎉 × ${confettiTaps}`}
                  </span>
                </button>
              )}

              {/* New Round Form */}
              {isHost && showNewRoundForm && (
                <div className="w-full max-w-sm mx-auto animate-fade-in">
                  <div className="bg-surface rounded-2xl p-5 border border-border">
                    <h3 className="text-lg font-bold text-text-primary mb-3 text-center">New Round</h3>
                    <input
                      type="text"
                      value={newRoundTopic}
                      onChange={(e) => setNewRoundTopic(e.target.value)}
                      placeholder="Enter a topic..."
                      maxLength={500}
                      className="w-full px-4 py-3 rounded-lg bg-white border border-border text-text-primary placeholder-text-tertiary text-base focus:outline-none focus:ring-2 focus:ring-accent mb-3"
                      autoFocus
                    />

                    {/* Reset scores toggle */}
                    <label className="flex items-center justify-between px-1 mb-4 cursor-pointer">
                      <span className="text-text-secondary text-sm">Reset scores to $0</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={resetScores}
                        onClick={() => setResetScores(!resetScores)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          resetScores ? "bg-accent" : "bg-border"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            resetScores ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowNewRoundForm(false);
                          setNewRoundTopic("");
                          setResetScores(false);
                        }}
                        className="flex-1 py-3 rounded-lg font-bold text-base bg-white border border-border text-text-secondary hover:bg-surface-hover transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => onNewRound?.(newRoundTopic.trim(), resetScores)}
                        disabled={!newRoundTopic.trim()}
                        className="flex-1 py-3 rounded-lg font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent-cyan text-white hover:opacity-90"
                      >
                        Go
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
