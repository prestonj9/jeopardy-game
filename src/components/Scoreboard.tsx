"use client";

import type { SerializablePlayer } from "@/lib/types";

interface ScoreboardProps {
  players: SerializablePlayer[];
  activePlayerId?: string | null;
}

export default function Scoreboard({ players, activePlayerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full bg-surface/80 backdrop-blur-sm rounded-2xl p-4 border border-border">
      <div className="flex flex-wrap gap-4 justify-center">
        {sorted.map((player) => (
          <div
            key={player.id}
            className={`flex flex-col items-center px-6 py-3 rounded-full min-w-[120px] transition-all ${
              player.id === activePlayerId
                ? "bg-accent/10 ring-2 ring-accent"
                : "bg-white/50 border border-white/60"
            } ${!player.isConnected ? "opacity-40" : ""}`}
          >
            <span className="text-text-primary font-medium text-sm truncate max-w-[120px]">
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
        ))}
        {players.length === 0 && (
          <p className="text-text-tertiary text-sm">No players yet</p>
        )}
      </div>
    </div>
  );
}
