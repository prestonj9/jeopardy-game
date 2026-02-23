"use client";

import type { SerializablePlayer } from "@/lib/types";

interface ScoreboardProps {
  players: SerializablePlayer[];
  activePlayerId?: string | null;
}

export default function Scoreboard({ players, activePlayerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full bg-[#1a1a2e] rounded-lg p-4">
      <div className="flex flex-wrap gap-4 justify-center">
        {sorted.map((player) => (
          <div
            key={player.id}
            className={`flex flex-col items-center px-6 py-3 rounded-lg min-w-[120px] transition-all ${
              player.id === activePlayerId
                ? "bg-jeopardy-buzz/20 ring-2 ring-jeopardy-buzz"
                : "bg-white/5"
            } ${!player.isConnected ? "opacity-40" : ""}`}
          >
            <span className="text-white font-medium text-sm truncate max-w-[120px]">
              {player.name}
            </span>
            <span
              className={`font-bold text-lg ${
                player.score < 0 ? "text-red-400" : "text-jeopardy-gold"
              }`}
            >
              ${player.score.toLocaleString()}
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-white/40 text-sm">No players yet</p>
        )}
      </div>
    </div>
  );
}
