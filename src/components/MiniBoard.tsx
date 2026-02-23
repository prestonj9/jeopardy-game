"use client";

import type { SerializableBoard } from "@/lib/types";

interface MiniBoardProps {
  board: SerializableBoard;
  onSelectClue: (categoryIndex: number, clueIndex: number) => void;
  disabled?: boolean;
}

export default function MiniBoard({ board, onSelectClue, disabled }: MiniBoardProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-6 gap-[2px] bg-black/50 rounded-lg overflow-hidden">
        {/* Category Headers */}
        {board.categories.map((cat, ci) => (
          <div
            key={`cat-${ci}`}
            className="bg-jeopardy-category p-1.5 flex items-center justify-center min-h-[40px]"
          >
            <span className="text-white font-bold text-center text-[10px] leading-tight uppercase line-clamp-2">
              {cat.name}
            </span>
          </div>
        ))}

        {/* Clue Cells */}
        {[0, 1, 2, 3, 4].map((clueIndex) =>
          board.categories.map((cat, ci) => {
            const clue = cat.clues[clueIndex];
            const isRevealed = clue.isRevealed;

            return (
              <button
                key={`clue-${ci}-${clueIndex}`}
                onClick={() => !isRevealed && !disabled && onSelectClue(ci, clueIndex)}
                disabled={isRevealed || disabled}
                className={`py-2 flex items-center justify-center transition-all ${
                  isRevealed
                    ? "bg-[#1a1a2e]/50 cursor-default"
                    : "bg-jeopardy-blue active:scale-90 active:brightness-150"
                }`}
              >
                {!isRevealed && (
                  <span className="text-jeopardy-gold font-bold text-xs">
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
