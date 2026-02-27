"use client";

import type { SerializablePlayer } from "@/lib/types";
import QRCodeDisplay from "./QRCode";

interface LobbyProps {
  gameId: string;
  players: SerializablePlayer[];
  isHost: boolean;
  onStartGame?: () => void;
  onRetryGeneration?: () => void;
  boardStatus?: "generating" | "ready" | "failed";
  boardError?: string;
  startRequested?: boolean;
}

export default function Lobby({
  gameId,
  players,
  isHost,
  onStartGame,
  onRetryGeneration,
  boardStatus = "ready",
  boardError,
  startRequested,
}: LobbyProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-border text-center">
        {/* Game Code */}
        <p className="text-text-secondary text-sm uppercase tracking-wider mb-1">
          Game Code
        </p>
        <h2 className="text-5xl font-bold text-gradient-accent tracking-[0.3em] mb-6">
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
          <p className="text-text-secondary text-sm uppercase tracking-wider mb-3">
            Players ({players.length})
          </p>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white/50 rounded-full border border-white/60"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    player.isConnected ? "bg-green-400" : "bg-gray-500"
                  }`}
                />
                <span className="text-text-primary font-medium">{player.name}</span>
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-text-tertiary text-sm py-4">
                Waiting for players to join...
              </p>
            )}
          </div>
        </div>

        {/* Board generation status */}
        {boardStatus === "generating" && (
          <div className="flex items-center justify-center gap-2 text-text-secondary mb-4">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Generating game board...</span>
          </div>
        )}
        {boardStatus === "ready" && (
          <div className="flex items-center justify-center gap-2 text-success mb-4 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Board ready</span>
          </div>
        )}
        {boardStatus === "failed" && (
          <div className="mb-4">
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm mb-2">
              {boardError || "Board generation failed"}
            </div>
            {isHost && (
              <button
                onClick={onRetryGeneration}
                className="w-full py-3 rounded-full font-bold text-base transition-all bg-danger text-white hover:opacity-90 active:scale-[0.98]"
              >
                Retry Generation
              </button>
            )}
          </div>
        )}

        {/* Host Controls */}
        {isHost && boardStatus !== "failed" && (
          <button
            onClick={onStartGame}
            disabled={players.length === 0}
            className="w-full py-4 rounded-full font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-text-primary text-white hover:opacity-90 active:scale-[0.98]"
          >
            {startRequested ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Waiting for board...
              </span>
            ) : (
              "Start Game"
            )}
          </button>
        )}

        {/* Player waiting */}
        {!isHost && (
          <div className="flex items-center justify-center gap-2 text-text-secondary">
            <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" />
            <div
              className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce"
              style={{ animationDelay: "0.15s" }}
            />
            <div
              className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce"
              style={{ animationDelay: "0.3s" }}
            />
            <span className="ml-2">Waiting for host to start...</span>
          </div>
        )}
      </div>
    </div>
  );
}
