import Link from "next/link";
import InteractiveHero from "@/components/InteractiveHero";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Interactive color spectrum hero */}
      <InteractiveHero />

      {/* Title */}
      <div className="relative z-10 text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-bold text-text-primary tracking-tight mb-3">
          JEOPARDY
        </h1>
        <p className="text-text-secondary text-lg md:text-xl">
          AI-powered trivia for your next game night
        </p>
      </div>

      {/* Buttons */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/create"
          className="flex-1 py-5 rounded-xl font-bold text-xl text-center bg-gradient-to-r from-accent to-accent-cyan text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
        >
          Host a Game
        </Link>
        <Link
          href="/play"
          className="flex-1 py-5 rounded-xl font-bold text-xl text-center bg-surface text-text-primary border border-border hover:bg-surface-hover active:scale-[0.98] transition-all"
        >
          Join a Game
        </Link>
      </div>
    </div>
  );
}
