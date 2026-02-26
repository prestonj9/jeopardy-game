"use client";

import type { SerializablePlayer } from "@/lib/types";

interface ScoreboardProps {
  players: SerializablePlayer[];
  activePlayerId?: string | null;
  boardControlPlayerId?: string | null;
}

export default function Scoreboard({ players, activePlayerId, boardControlPlayerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full bg-surface/80 backdrop-blur-sm rounded-2xl p-4 border border-border">
      <div className="flex flex-wrap gap-4 justify-center">
        {sorted.map((player) => {
          const isAnswering = player.id === activePlayerId;
          const hasBoardControl =
            !isAnswering && player.id === boardControlPlayerId;

          return (
          <div
            key={player.id}
            className={`flex flex-col items-center px-6 py-3 rounded-full min-w-[120px] transition-all ${
              isAnswering
                ? "bg-accent/10 ring-2 ring-accent"
                : hasBoardControl
                  ? "bg-accent/5 ring-2 ring-accent/30 ring-dashed"
                  : "bg-white/50 border border-white/60"
            } ${!player.isConnected ? "opacity-40" : ""}`}
          >
            <span className="text-text-primary font-medium text-sm truncate max-w-[120px]">
              {hasBoardControl && <span className="text-accent/60 mr-0.5">▸ </span>}
              {player.name}
            </span>
            <span
              className={`font-bold text-lg ${
                player.score < 0 ? "text-danger" : "text-accent"
              }`}
            >
              ${player.score.toLocaleString()}
            </span>
          </div>
          );
        })}
        {players.length === 0 && (
          <p className="text-text-tertiary text-sm">No players yet</p>
        )}
      </div>
    </div>
  );
}
