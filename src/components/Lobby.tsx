"use client";

import type { SerializablePlayer } from "@/lib/types";
import QRCodeDisplay from "./QRCode";

interface LobbyProps {
  gameId: string;
  players: SerializablePlayer[];
  isHost: boolean;
  onStartGame?: () => void;
}

export default function Lobby({
  gameId,
  players,
  isHost,
  onStartGame,
}: LobbyProps) {
  return (
    <div className="min-h-screen bg-jeopardy-blue flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-jeopardy-category rounded-xl p-8 shadow-2xl text-center">
        {/* Game Code */}
        <p className="text-white/60 text-sm uppercase tracking-wider mb-1">
          Game Code
        </p>
        <h2 className="text-5xl font-bold text-jeopardy-gold tracking-[0.3em] mb-6">
          {gameId}
        </h2>

        {/* QR Code — only shown to non-host views (players, display) */}
        {!isHost && (
          <div className="mb-6">
            <QRCodeDisplay gameId={gameId} />
          </div>
        )}

        {/* Players */}
        <div className="mb-6">
          <p className="text-white/60 text-sm uppercase tracking-wider mb-3">
            Players ({players.length})
          </p>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 rounded-lg"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    player.isConnected ? "bg-green-400" : "bg-gray-500"
                  }`}
                />
                <span className="text-white font-medium">{player.name}</span>
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-white/30 text-sm py-4">
                Waiting for players to join...
              </p>
            )}
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <button
            onClick={onStartGame}
            disabled={players.length === 0}
            className="w-full py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-jeopardy-gold text-jeopardy-category hover:brightness-110 active:scale-[0.98]"
          >
            Start Game
          </button>
        )}

        {/* Player waiting */}
        {!isHost && (
          <div className="flex items-center justify-center gap-2 text-white/60">
            <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
            <div
              className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
              style={{ animationDelay: "0.15s" }}
            />
            <div
              className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
              style={{ animationDelay: "0.3s" }}
            />
            <span className="ml-2">Waiting for host to start...</span>
          </div>
        )}
      </div>
    </div>
  );
}
