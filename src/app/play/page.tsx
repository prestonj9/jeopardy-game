"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InteractiveHero from "@/components/InteractiveHero";

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
    <div className="w-full max-w-sm bg-white/25 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/60 relative z-10">
      <h1 className="text-3xl font-bold text-text-primary text-center mb-8">
        Join Game
      </h1>

      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-text-primary text-sm font-medium mb-2">
            Game Code
          </label>
          <input
            type="text"
            value={gameCode}
            onChange={(e) =>
              setGameCode(e.target.value.toUpperCase().slice(0, 6))
            }
            placeholder="Enter code"
            className="w-full px-4 py-3 text-2xl text-center font-bold tracking-[0.2em] rounded-full bg-white/50 border border-white/60 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent uppercase"
            maxLength={6}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-text-primary text-sm font-medium mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
            placeholder="Enter your name"
            className="w-full px-5 py-3 text-lg rounded-full bg-white/50 border border-white/60 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            maxLength={20}
          />
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-full text-danger text-sm px-5">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-4 rounded-full font-bold text-xl bg-text-primary text-white hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Join
        </button>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      <InteractiveHero />
      <Suspense
        fallback={
          <div className="w-full max-w-sm bg-white/25 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/60 text-center relative z-10">
            <p className="text-text-secondary text-lg">Loading...</p>
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
