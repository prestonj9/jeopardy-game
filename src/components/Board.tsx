"use client";

import type { SerializableBoard } from "@/lib/types";

interface BoardProps {
  board: SerializableBoard;
  onSelectClue: (categoryIndex: number, clueIndex: number) => void;
  disabled?: boolean;
}

export default function Board({ board, onSelectClue, disabled }: BoardProps) {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-6 gap-2 p-2">
        {/* Category Headers */}
        {board.categories.map((cat, ci) => (
          <div
            key={`cat-${ci}`}
            className="bg-text-primary rounded-xl p-3 flex items-center justify-center min-h-[80px]"
          >
            <span className="text-white font-bold text-center text-sm md:text-base uppercase leading-tight">
              {cat.name}
            </span>
          </div>
        ))}

        {/* Clue Cells — iterate by row (value), then column (category) */}
        {[0, 1, 2, 3, 4].map((clueIndex) =>
          board.categories.map((cat, ci) => {
            const clue = cat.clues[clueIndex];
            const isRevealed = clue.isRevealed;

            return (
              <button
                key={`clue-${ci}-${clueIndex}`}
                onClick={() => !isRevealed && !disabled && onSelectClue(ci, clueIndex)}
                disabled={isRevealed || disabled}
                className={`aspect-[4/3] flex items-center justify-center transition-all rounded-xl ${
                  isRevealed
                    ? "bg-white border border-border/50 opacity-40 cursor-default"
                    : "bg-surface border border-border hover:bg-surface-hover cursor-pointer active:scale-95"
                }`}
              >
                {!isRevealed && (
                  <span className="text-text-primary font-bold text-xl md:text-2xl lg:text-3xl">
                    ${clue.value}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
