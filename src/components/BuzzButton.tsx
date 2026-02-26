"use client";

interface BuzzButtonProps {
  state: "disabled" | "active" | "buzzed" | "locked_out";
  onBuzz: () => void;
  countdown?: number | null;
  countdownTotalSeconds?: number | null;
}

export default function BuzzButton({ state, onBuzz, countdown, countdownTotalSeconds }: BuzzButtonProps) {
  const totalSecs = countdownTotalSeconds ?? 4;
  const showCountdown = (state === "disabled" || state === "active") && countdown !== null && countdown !== undefined && countdown > 0;

  const config = {
    disabled: {
      bg: "bg-surface",
      text: "WAIT",
      textColor: "text-text-tertiary",
      cursor: "cursor-not-allowed",
      animate: "",
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
      onClick={state === "active" ? () => { navigator.vibrate?.(50); onBuzz(); } : undefined}
      disabled={state !== "active"}
      className={`relative w-full min-h-[80px] rounded-full font-bold text-3xl transition-all active:scale-95 select-none overflow-hidden ${c.bg} ${c.textColor} ${c.cursor} ${c.animate}`}
      style={{ touchAction: "manipulation" }}
    >
      {c.text}

      {/* Mini progress bar along bottom edge */}
      {showCountdown && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
          <div
            className="h-full bg-accent rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((countdown ?? 0) / totalSecs) * 100}%` }}
          />
        </div>
      )}
    </button>
  );
}
