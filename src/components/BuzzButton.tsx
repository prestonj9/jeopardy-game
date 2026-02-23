"use client";

interface BuzzButtonProps {
  state: "disabled" | "active" | "buzzed" | "locked_out";
  onBuzz: () => void;
  countdown?: number | null;
}

export default function BuzzButton({ state, onBuzz, countdown }: BuzzButtonProps) {
  // During countdown, show the number instead of generic "WAIT"
  const showCountdown = state === "disabled" && countdown !== null && countdown !== undefined && countdown > 0;

  const config = {
    disabled: {
      bg: "bg-gray-600",
      text: showCountdown ? String(countdown) : "WAIT",
      cursor: "cursor-not-allowed",
      animate: showCountdown ? "text-6xl" : "",
    },
    active: {
      bg: "bg-jeopardy-buzz",
      text: "BUZZ!",
      cursor: "cursor-pointer",
      animate: "animate-pulse shadow-[0_0_30px_rgba(255,69,0,0.5)]",
    },
    buzzed: {
      bg: "bg-blue-600",
      text: "BUZZED!",
      cursor: "cursor-not-allowed",
      animate: "",
    },
    locked_out: {
      bg: "bg-gray-700",
      text: "LOCKED OUT",
      cursor: "cursor-not-allowed",
      animate: "",
    },
  };

  const c = config[state];

  return (
    <button
      onClick={state === "active" ? onBuzz : undefined}
      disabled={state !== "active"}
      className={`w-full min-h-[80px] rounded-2xl font-bold text-3xl text-white transition-all active:scale-95 select-none ${c.bg} ${c.cursor} ${c.animate}`}
      style={{ touchAction: "manipulation" }}
    >
      {c.text}
    </button>
  );
}
