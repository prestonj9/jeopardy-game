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
      bg: "bg-surface",
      text: showCountdown ? String(countdown) : "WAIT",
      textColor: "text-text-tertiary",
      cursor: "cursor-not-allowed",
      animate: showCountdown ? "text-6xl" : "",
    },
    active: {
      bg: "bg-gradient-to-r from-accent to-accent-cyan",
      text: "BUZZ!",
      textColor: "text-white",
      cursor: "cursor-pointer",
      animate: "animate-pulse shadow-glow-accent",
    },
    buzzed: {
      bg: "bg-accent",
      text: "BUZZED!",
      textColor: "text-white",
      cursor: "cursor-not-allowed",
      animate: "",
    },
    locked_out: {
      bg: "bg-surface",
      text: "LOCKED OUT",
      textColor: "text-text-tertiary",
      cursor: "cursor-not-allowed",
      animate: "",
    },
  };

  const c = config[state];

  return (
    <button
      onClick={state === "active" ? onBuzz : undefined}
      disabled={state !== "active"}
      className={`w-full min-h-[80px] rounded-full font-bold text-3xl transition-all active:scale-95 select-none ${c.bg} ${c.textColor} ${c.cursor} ${c.animate}`}
      style={{ touchAction: "manipulation" }}
    >
      {c.text}
    </button>
  );
}
