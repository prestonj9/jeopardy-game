"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gameCode, setGameCode] = useState(
    searchParams.get("code") || ""
  );
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = gameCode.trim().toUpperCase();
    const name = playerName.trim();

    if (!code) {
      setError("Enter a game code");
      return;
    }
    if (!name) {
      setError("Enter your name");
      return;
    }

    // Navigate to player game view — join will happen via socket there
    router.push(
      `/play/${code}?name=${encodeURIComponent(name)}`
    );
  }

  return (
    <div className="w-full max-w-sm bg-jeopardy-category rounded-xl p-8 shadow-2xl">
      <h1 className="text-3xl font-bold text-jeopardy-gold text-center mb-8">
        Join Game
      </h1>

      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-white text-sm font-medium mb-2">
            Game Code
          </label>
          <input
            type="text"
            value={gameCode}
            onChange={(e) =>
              setGameCode(e.target.value.toUpperCase().slice(0, 6))
            }
            placeholder="Enter code"
            className="w-full px-4 py-3 text-2xl text-center font-bold tracking-[0.2em] rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-jeopardy-gold uppercase"
            maxLength={6}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-white text-sm font-medium mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
            placeholder="Enter your name"
            className="w-full px-4 py-3 text-lg rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-jeopardy-gold"
            maxLength={20}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-4 rounded-lg font-bold text-xl bg-jeopardy-gold text-jeopardy-category hover:brightness-110 active:scale-[0.98] transition-all"
        >
          Join
        </button>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-jeopardy-blue flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-sm bg-jeopardy-category rounded-xl p-8 shadow-2xl text-center">
            <p className="text-white text-lg">Loading…</p>
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
