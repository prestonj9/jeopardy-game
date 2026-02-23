"use client";

import type { ClueState } from "@/lib/types";

interface ClueOverlayProps {
  clueText: string;
  value: number;
  clueState: ClueState;
  answeringPlayerName?: string;
  isDailyDouble: boolean;
  dailyDoublePlayerName?: string;
  buzzCountdown: number | null;
}

export default function ClueOverlay({
  clueText,
  value,
  clueState,
  answeringPlayerName,
  isDailyDouble,
  dailyDoublePlayerName,
  buzzCountdown,
}: ClueOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4 md:p-8">
      {/* Centered modal card */}
      <div className="bg-jeopardy-blue rounded-2xl border-2 border-jeopardy-gold/30 shadow-2xl p-8 md:p-12 max-w-4xl w-[90vw] flex flex-col items-center">
        {/* Daily Double Banner */}
        {isDailyDouble && clueState === "daily_double_wager" && (
          <div className="text-center animate-pulse">
            <h2 className="text-5xl md:text-7xl font-bold text-jeopardy-gold drop-shadow-lg">
              DAILY DOUBLE!
            </h2>
            {dailyDoublePlayerName && (
              <p className="text-white text-xl md:text-2xl mt-4">
                {dailyDoublePlayerName} is wagering...
              </p>
            )}
          </div>
        )}

        {/* Value badge */}
        {clueState !== "daily_double_wager" && (
          <div className="mb-6">
            <span className="text-jeopardy-gold font-bold text-3xl md:text-4xl drop-shadow-lg">
              ${value}
            </span>
          </div>
        )}

        {/* Clue Text */}
        {clueState !== "daily_double_wager" && (
          <div className="max-w-3xl text-center mb-8">
            <p className="text-white text-2xl md:text-4xl font-medium leading-relaxed uppercase">
              {clueText}
            </p>
          </div>
        )}

        {/* State indicator area */}
        <div className="text-center mt-4">
          {/* Countdown */}
          {clueState === "showing_clue" && buzzCountdown !== null && buzzCountdown > 0 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/50 text-sm uppercase tracking-widest">
                Buzzers open in
              </p>
              <span
                key={buzzCountdown}
                className="text-8xl md:text-9xl font-black text-jeopardy-gold animate-[ping_0.8s_ease-out_1] drop-shadow-lg"
              >
                {buzzCountdown}
              </span>
            </div>
          )}

          {/* Buzzers just opened (countdown hit 0 or naturally open) */}
          {clueState === "buzzing_open" && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-4xl md:text-5xl font-black animate-pulse">
                  BUZZ!
                </span>
                <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Player answering */}
          {clueState === "player_answering" && answeringPlayerName && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/50 text-sm uppercase tracking-widest">
                Answering
              </p>
              <p className="text-white text-3xl md:text-4xl font-bold">
                {answeringPlayerName}
              </p>
            </div>
          )}

          {/* Showing clue without countdown (e.g. re-buzz after incorrect) */}
          {clueState === "showing_clue" && (buzzCountdown === null || buzzCountdown === 0) && (
            <p className="text-white/40 text-lg">Waiting...</p>
          )}
        </div>
      </div>
    </div>
  );
}
