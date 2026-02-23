"use client";

interface HostControlsProps {
  allCluesRevealed: boolean;
  onStartFinal: () => void;
  gameStatus: string;
}

export default function HostControls({
  allCluesRevealed,
  onStartFinal,
  gameStatus,
}: HostControlsProps) {
  if (gameStatus !== "active") return null;

  return (
    <div className="flex justify-center gap-4 mt-4">
      {allCluesRevealed && (
        <button
          onClick={onStartFinal}
          className="px-8 py-3 bg-jeopardy-gold text-jeopardy-category font-bold text-lg rounded-lg hover:brightness-110 active:scale-95 transition-all animate-pulse"
        >
          Start Final Jeopardy
        </button>
      )}
    </div>
  );
}
