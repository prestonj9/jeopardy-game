import Link from "next/link";
import InteractiveHero from "@/components/InteractiveHero";
import TypewriterTagline from "@/components/TypewriterTagline";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Interactive color spectrum hero */}
      <InteractiveHero />

      {/* Title */}
      <div className="relative z-10 text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-bold text-text-primary tracking-tight mb-3">
          JEOPARD<span className="inline-flex items-center justify-center rounded-lg px-2 md:px-3 py-0.5 md:py-1 ml-1 align-baseline border-2 border-accent text-gradient-accent">AI</span>
        </h1>
        <TypewriterTagline />
      </div>

      {/* Buttons */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/create"
          className="flex-1 py-5 rounded-full font-bold text-xl text-center bg-text-primary text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
        >
          Host a Game
        </Link>
        <Link
          href="/play"
          className="flex-1 py-5 rounded-full font-bold text-xl text-center bg-white/50 backdrop-blur-lg text-text-primary border border-white/60 hover:bg-white/70 active:scale-[0.98] transition-all"
        >
          Join a Game
        </Link>
      </div>
    </div>
  );
}
