"use client";

import { useState, useRef, useEffect } from "react";

interface GameMenuProps {
  gameId: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onShowJoinQR: () => void;
}

export default function GameMenu({
  gameId,
  isMuted,
  onToggleMute,
  onShowJoinQR,
}: GameMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function handleCopyCode() {
    navigator.clipboard.writeText(gameId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleMute() {
    onToggleMute();
    setIsOpen(false);
  }

  function handleJoinRound() {
    onShowJoinQR();
    setIsOpen(false);
  }

  return (
    <div className="absolute top-4 right-4 z-40" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-center w-10 h-10 bg-surface hover:bg-surface-hover border border-border rounded-lg transition-all"
        aria-label="Game menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-text-secondary"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-56 bg-white border border-border rounded-xl shadow-lg overflow-hidden animate-[fadeIn_0.15s_ease-in]">
          {/* Game Code */}
          <button
            onClick={handleCopyCode}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-text-tertiary flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="text-text-secondary text-xs uppercase tracking-wider">
                Game Code
              </span>
              <div className="text-accent font-bold text-sm tracking-widest">
                {gameId}
              </div>
            </div>
            {copied && (
              <span className="text-success text-xs font-medium">Copied!</span>
            )}
          </button>

          <div className="border-t border-border" />

          {/* Mute / Unmute */}
          <button
            onClick={handleMute}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
          >
            {isMuted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-text-tertiary flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-text-tertiary flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            )}
            <span className="text-text-primary text-sm font-medium">
              {isMuted ? "Unmute Sounds" : "Mute Sounds"}
            </span>
          </button>

          <div className="border-t border-border" />

          {/* Join Round */}
          <button
            onClick={handleJoinRound}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-text-tertiary flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14v3h3M14 14h3v3M14 20h3v0M20 17v3h0"
              />
            </svg>
            <span className="text-text-primary text-sm font-medium">
              Join Round
            </span>
          </button>

          <div className="border-t border-border" />

          {/* Leave Game */}
          <a
            href="/create"
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-danger/5 transition-colors text-left"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-danger/70 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="text-danger/70 text-sm font-medium">
              Leave Game
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
