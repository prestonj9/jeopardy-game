"use client";

import { useEffect, useRef, useState } from "react";
import type { SerializablePlayer } from "@/lib/types";

interface ScoreDelta {
  playerId: string;
  amount: number;
  key: number; // unique key for re-triggering animation
}

interface ScoreboardProps {
  players: SerializablePlayer[];
  activePlayerId?: string | null;
  boardControlPlayerId?: string | null;
}

export default function Scoreboard({ players, activePlayerId, boardControlPlayerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const prevScoresRef = useRef<Record<string, number>>({});
  const [deltas, setDeltas] = useState<ScoreDelta[]>([]);
  const [flashPlayers, setFlashPlayers] = useState<Record<string, "correct" | "incorrect">>({});
  const deltaKeyRef = useRef(0);

  // Detect score changes and trigger animations
  useEffect(() => {
    const prevScores = prevScoresRef.current;
    const newDeltas: ScoreDelta[] = [];
    const newFlash: Record<string, "correct" | "incorrect"> = {};

    for (const player of players) {
      const prev = prevScores[player.id];
      if (prev !== undefined && prev !== player.score) {
        const amount = player.score - prev;
        deltaKeyRef.current += 1;
        newDeltas.push({
          playerId: player.id,
          amount,
          key: deltaKeyRef.current,
        });
        newFlash[player.id] = amount > 0 ? "correct" : "incorrect";
      }
    }

    if (newDeltas.length > 0) {
      setDeltas(newDeltas);
      setFlashPlayers(newFlash);

      // Clear deltas and flash after animation completes
      const timer = setTimeout(() => {
        setDeltas([]);
        setFlashPlayers({});
      }, 1200);
      return () => clearTimeout(timer);
    }

    // Update previous scores ref
    const currentScores: Record<string, number> = {};
    for (const p of players) {
      currentScores[p.id] = p.score;
    }
    prevScoresRef.current = currentScores;
  }, [players]);

  // Always keep ref in sync (including after animation cleanup)
  useEffect(() => {
    const currentScores: Record<string, number> = {};
    for (const p of players) {
      currentScores[p.id] = p.score;
    }
    prevScoresRef.current = currentScores;
  });

  return (
    <div className="w-full bg-surface/80 backdrop-blur-sm rounded-2xl p-4 border border-border">
      <div className="flex flex-wrap gap-4 justify-center">
        {sorted.map((player) => {
          const isAnswering = player.id === activePlayerId;
          const hasBoardControl =
            !isAnswering && player.id === boardControlPlayerId;
          const flash = flashPlayers[player.id];
          const delta = deltas.find((d) => d.playerId === player.id);

          return (
          <div
            key={player.id}
            className={`relative flex flex-col items-center px-6 py-3 rounded-full min-w-[120px] transition-all ${
              isAnswering
                ? "bg-accent/10 ring-2 ring-accent"
                : hasBoardControl
                  ? "bg-accent/5 ring-2 ring-accent/30 ring-dashed"
                  : flash === "correct"
                    ? "bg-success/10 ring-2 ring-success"
                    : flash === "incorrect"
                      ? "bg-danger/10 ring-2 ring-danger"
                      : "bg-white/50 border border-white/60"
            } ${!player.isConnected ? "opacity-40" : ""}`}
          >
            <span className="text-text-primary font-medium text-sm truncate max-w-[120px]">
              {hasBoardControl && <span className="text-accent/60 mr-0.5">&#9656; </span>}
              {player.name}
            </span>
            <span
              className={`font-bold text-lg ${
                player.score < 0 ? "text-danger" : "text-accent"
              } ${delta ? "animate-score-pop" : ""}`}
            >
              ${player.score.toLocaleString()}
            </span>

            {/* Floating score delta */}
            {delta && (
              <span
                key={delta.key}
                className={`absolute -top-1 left-1/2 -translate-x-1/2 font-bold text-sm animate-score-float pointer-events-none ${
                  delta.amount > 0 ? "text-success" : "text-danger"
                }`}
              >
                {delta.amount > 0 ? "+" : ""}${delta.amount.toLocaleString()}
              </span>
            )}
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
