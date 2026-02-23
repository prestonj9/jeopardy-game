"use client";

import type { SerializablePlayer } from "@/lib/types";
import QRCodeDisplay from "./QRCode";

interface DisplayLobbyProps {
  gameId: string;
  players: SerializablePlayer[];
}

export default function DisplayLobby({ gameId, players }: DisplayLobbyProps) {
  const remoteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/host/${gameId}/remote`
      : "";

  return (
    <div className="min-h-screen bg-jeopardy-blue flex flex-col items-center justify-center p-8">
      {/* Game Code */}
      <p className="text-white/60 text-sm uppercase tracking-wider mb-2">
        Game Code
      </p>
      <h2 className="text-7xl md:text-9xl font-bold text-jeopardy-gold tracking-[0.3em] mb-8">
        {gameId}
      </h2>

      <div className="flex flex-col md:flex-row gap-12 items-start mb-12">
        {/* Player QR */}
        <div className="flex flex-col items-center">
          <p className="text-white/80 text-lg font-bold uppercase tracking-wider mb-3">
            Players — Scan to Join
          </p>
          <QRCodeDisplay gameId={gameId} />
        </div>

        {/* Host Remote QR */}
        {remoteUrl && (
          <div className="flex flex-col items-center">
            <p className="text-white/80 text-lg font-bold uppercase tracking-wider mb-3">
              Host Remote
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-white/60 text-sm text-center max-w-[200px]">
                Open on your phone to control the game:
              </p>
              <p className="text-jeopardy-gold text-xs text-center mt-2 break-all">
                /host/{gameId}/remote
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Player List */}
      <div className="w-full max-w-2xl">
        <p className="text-white/60 text-sm uppercase tracking-wider mb-3 text-center">
          Players ({players.length})
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 px-5 py-3 bg-jeopardy-category rounded-lg"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  player.isConnected ? "bg-green-400" : "bg-gray-500"
                }`}
              />
              <span className="text-white font-bold text-lg">{player.name}</span>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-white/30 text-lg py-4">
              Waiting for players to join...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
