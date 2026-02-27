"use client";

import type { ClueState, CountdownType } from "@/lib/types";

interface ClueOverlayProps {
  clueText: string;
  value: number;
  clueState: ClueState;
  answeringPlayerName?: string;
  isDailyDouble: boolean;
  dailyDoublePlayerName?: string;
  buzzCountdown: number | null;
  countdownType: CountdownType | null;
  countdownTotalSeconds: number | null;
  revealedAnswer?: string | null;
}

export default function ClueOverlay({
  clueText,
  value,
  clueState,
  answeringPlayerName,
  isDailyDouble,
  dailyDoublePlayerName,
  buzzCountdown,
  countdownType,
  countdownTotalSeconds,
  revealedAnswer,
}: ClueOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4 md:p-8">
      {/* Centered modal card */}
      <div className="bg-white rounded-2xl border border-border shadow-2xl p-8 md:p-12 max-w-4xl w-[90vw] flex flex-col items-center">
        {/* Daily Double Banner */}
        {isDailyDouble && clueState === "daily_double_wager" && (
          <div className="text-center animate-gradient-reveal">
            <h2 className="text-5xl md:text-7xl font-bold text-gradient-accent">
              DAILY DOUBLE!
            </h2>
            {dailyDoublePlayerName && (
              <p className="text-text-secondary text-xl md:text-2xl mt-4">
                {dailyDoublePlayerName} is wagering...
              </p>
            )}
          </div>
        )}

        {/* Value badge */}
        {clueState !== "daily_double_wager" && (
          <div className="mb-6">
            <span className="text-gradient-accent font-bold text-3xl md:text-4xl">
              ${value}
            </span>
          </div>
        )}

        {/* Clue Text */}
        {clueState !== "daily_double_wager" && (
          <div className="max-w-3xl text-center mb-8">
            <p className="text-text-primary text-2xl md:text-4xl font-medium leading-relaxed uppercase">
              {clueText}
            </p>
          </div>
        )}

        {/* Countdown progress bar — visible for all timer types */}
        {buzzCountdown !== null && buzzCountdown > 0 && countdownTotalSeconds && (
          <div className="w-full mt-2 mb-4">
            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(buzzCountdown / countdownTotalSeconds) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* State indicator area */}
        <div className="text-center mt-4">
          {/* Countdown — bar shown above, no text here */}

          {/* Buzzers just opened (countdown hit 0 or naturally open) */}
          {clueState === "buzzing_open" && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-success rounded-full animate-pulse" />
                <span className="text-success text-4xl md:text-5xl font-black animate-pulse">
                  BUZZ!
                </span>
                <div className="w-4 h-4 bg-success rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Player answering */}
          {clueState === "player_answering" && answeringPlayerName && (
            <div className="flex flex-col items-center gap-2 animate-buzz-in-reveal">
              <p className="text-text-secondary text-sm uppercase tracking-widest">
                Answering
              </p>
              <p className="text-text-primary text-4xl md:text-5xl font-bold">
                {answeringPlayerName}
              </p>
              {/* Time's Up indicator when answer timer expires */}
              {countdownType === "answer" && buzzCountdown === 0 && (
                <p className="text-danger text-2xl md:text-3xl font-bold animate-pulse mt-2">
                  Time&apos;s Up!
                </p>
              )}
            </div>
          )}

          {/* Showing clue without countdown (e.g. re-buzz after incorrect) */}
          {clueState === "showing_clue" && (buzzCountdown === null || buzzCountdown === 0) && (
            <p className="text-text-tertiary text-lg">Waiting...</p>
          )}

          {/* Awaiting reveal — no one answered */}
          {clueState === "awaiting_reveal" && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-text-secondary text-2xl md:text-3xl font-bold">
                No one answered
              </p>
            </div>
          )}

          {/* Answer revealed — show correct answer prominently */}
          {clueState === "answer_revealed" && revealedAnswer && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-text-secondary text-sm uppercase tracking-widest">
                Correct Response
              </p>
              <p className="text-accent text-3xl md:text-5xl font-bold">
                {revealedAnswer}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
