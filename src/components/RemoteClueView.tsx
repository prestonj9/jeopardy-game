"use client";

import type { ClueState } from "@/lib/types";

interface RemoteClueViewProps {
  clueText: string;
  value: number;
  clueState: ClueState;
  correctResponse: string | null;
  answeringPlayerName?: string;
  isDailyDouble: boolean;
  buzzCountdown: number | null;
  onJudge: (correct: boolean) => void;
  onSkip: () => void;
}

export default function RemoteClueView({
  clueText,
  value,
  clueState,
  correctResponse,
  answeringPlayerName,
  isDailyDouble,
  buzzCountdown,
  onJudge,
  onSkip,
}: RemoteClueViewProps) {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      {/* Daily Double badge */}
      {isDailyDouble && clueState === "daily_double_wager" && (
        <div className="text-center py-4">
          <h2 className="text-3xl font-bold text-jeopardy-gold animate-pulse">
            DAILY DOUBLE!
          </h2>
          <p className="text-white/60 mt-1">Waiting for wager...</p>
        </div>
      )}

      {/* Value + Clue */}
      {clueState !== "daily_double_wager" && (
        <>
          <div className="text-center">
            <span className="text-jeopardy-gold font-bold text-xl">
              ${value}
            </span>
          </div>

          <div className="bg-jeopardy-category rounded-lg p-4">
            <p className="text-white text-base leading-relaxed">
              {clueText}
            </p>
          </div>
        </>
      )}

      {/* Correct Answer — always visible on host remote */}
      {correctResponse && clueState !== "daily_double_wager" && (
        <div className="border-2 border-jeopardy-gold/50 rounded-lg p-3 bg-jeopardy-gold/10">
          <p className="text-jeopardy-gold/70 text-xs uppercase tracking-wider mb-0.5">
            Answer
          </p>
          <p className="text-jeopardy-gold text-lg font-bold">
            {correctResponse}
          </p>
        </div>
      )}

      {/* State indicator + Controls */}
      <div className="flex-1 flex flex-col justify-end gap-3">
        {/* Showing clue with countdown */}
        {clueState === "showing_clue" && buzzCountdown !== null && buzzCountdown > 0 && (
          <div className="text-center py-4">
            <p className="text-white/50 text-sm uppercase tracking-wider">
              Buzzers open in
            </p>
            <span className="text-5xl font-black text-jeopardy-gold">
              {buzzCountdown}
            </span>
          </div>
        )}

        {/* Showing clue without countdown */}
        {clueState === "showing_clue" && (buzzCountdown === null || buzzCountdown === 0) && (
          <div className="text-center py-2">
            <p className="text-white/40 text-sm">Waiting...</p>
          </div>
        )}

        {/* Buzzers open */}
        {clueState === "buzzing_open" && (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xl font-bold">
                Buzzers OPEN
              </span>
            </div>
          </div>
        )}

        {/* Player answering — show name + judge buttons */}
        {clueState === "player_answering" && answeringPlayerName && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-white/50 text-xs uppercase tracking-wider">
                Answering
              </p>
              <p className="text-white text-2xl font-bold">
                {answeringPlayerName}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => onJudge(true)}
                className="flex-1 py-5 bg-green-500 text-white font-bold text-xl rounded-xl hover:bg-green-400 active:scale-95 transition-all"
              >
                ✓ Correct
              </button>
              <button
                onClick={() => onJudge(false)}
                className="flex-1 py-5 bg-red-500 text-white font-bold text-xl rounded-xl hover:bg-red-400 active:scale-95 transition-all"
              >
                ✗ Wrong
              </button>
            </div>
          </div>
        )}

        {/* Skip button — always available except when player is answering */}
        {clueState !== "player_answering" && clueState !== "daily_double_wager" && (
          <button
            onClick={onSkip}
            className="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 active:scale-95 transition-all"
          >
            Skip Clue
          </button>
        )}
      </div>
    </div>
  );
}
