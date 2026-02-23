import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-jeopardy-blue flex flex-col items-center justify-center p-6">
      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-bold text-jeopardy-gold drop-shadow-lg mb-3">
          JEOPARDY!
        </h1>
        <p className="text-white/60 text-lg md:text-xl">
          AI-powered trivia for your next game night
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/create"
          className="flex-1 py-5 rounded-xl font-bold text-xl text-center bg-jeopardy-gold text-jeopardy-category hover:brightness-110 active:scale-[0.98] transition-all shadow-lg"
        >
          Host a Game
        </Link>
        <Link
          href="/play"
          className="flex-1 py-5 rounded-xl font-bold text-xl text-center bg-white/10 text-white border-2 border-white/20 hover:bg-white/20 active:scale-[0.98] transition-all"
        >
          Join a Game
        </Link>
      </div>
    </div>
  );
}
