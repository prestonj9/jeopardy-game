"use client";

import { useState } from "react";
import type { SerializablePlayer } from "@/lib/types";
import QRCodeDisplay from "./QRCode";
import { QRCodeSVG } from "qrcode.react";

interface DisplayLobbyProps {
  gameId: string;
  players: SerializablePlayer[];
}

export default function DisplayLobby({ gameId, players }: DisplayLobbyProps) {
  const [showHostQR, setShowHostQR] = useState(false);

  const remoteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/host/${gameId}/remote`
      : "";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 relative">
      {/* Host Remote button — top-right corner */}
      <button
        onClick={() => setShowHostQR(true)}
        className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/50 hover:bg-white/70 border border-white/60 rounded-full transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="text-text-secondary text-sm font-medium">Host Remote</span>
      </button>

      {/* Game Code */}
      <p className="text-text-secondary text-sm uppercase tracking-wider mb-2">
        Game Code
      </p>
      <h2 className="text-7xl md:text-9xl font-bold text-gradient-accent tracking-[0.3em] mb-8">
        {gameId}
      </h2>

      {/* Player QR */}
      <div className="flex flex-col items-center mb-12">
        <p className="text-text-primary text-lg font-bold uppercase tracking-wider mb-3">
          Scan to Join
        </p>
        <QRCodeDisplay gameId={gameId} />
      </div>

      {/* Player List */}
      <div className="w-full max-w-2xl">
        <p className="text-text-secondary text-sm uppercase tracking-wider mb-3 text-center">
          Players ({players.length})
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 px-5 py-3 bg-surface border border-border rounded-full"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  player.isConnected ? "bg-green-400" : "bg-gray-500"
                }`}
              />
              <span className="text-text-primary font-bold text-lg">{player.name}</span>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-text-tertiary text-lg py-4">
              Waiting for players to join...
            </p>
          )}
        </div>
      </div>

      {/* Host Remote QR Modal */}
      {showHostQR && remoteUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowHostQR(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-text-primary text-2xl font-bold mb-2">
              Host Remote
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              Scan with your phone to control the game
            </p>

            <div className="bg-white p-4 rounded-lg inline-block mb-6 border border-border">
              <QRCodeSVG value={remoteUrl} size={200} />
            </div>

            <button
              onClick={() => setShowHostQR(false)}
              className="w-full py-3 bg-text-primary text-white font-bold rounded-full hover:opacity-90 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
