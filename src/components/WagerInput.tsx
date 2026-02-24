"use client";

import { useState } from "react";

interface WagerInputProps {
  maxWager: number;
  minWager?: number;
  playerScore: number;
  onSubmit: (amount: number) => void;
  label?: string;
}

export default function WagerInput({
  maxWager,
  minWager = 5,
  playerScore,
  onSubmit,
  label = "Enter your wager",
}: WagerInputProps) {
  const [amount, setAmount] = useState(minWager);

  const effectiveMax = Math.max(maxWager, minWager);

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface rounded-2xl border border-border">
      <h3 className="text-text-primary text-lg font-bold mb-1 text-center">
        {label}
      </h3>
      <p className="text-text-secondary text-sm text-center mb-4">
        Your score: ${playerScore.toLocaleString()}
      </p>

      <div className="mb-4">
        <input
          type="number"
          min={minWager}
          max={effectiveMax}
          value={amount}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0;
            setAmount(Math.max(minWager, Math.min(val, effectiveMax)));
          }}
          className="w-full px-4 py-3 text-2xl font-bold text-center bg-white/50 border border-white/60 rounded-full text-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Quick wager buttons */}
      <div className="flex gap-2 mb-4">
        {[100, 500, 1000].map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(Math.min(preset, effectiveMax))}
            className="flex-1 py-2 bg-white/50 text-text-primary rounded-full hover:bg-white/70 border border-white/60 transition-colors text-sm font-medium"
          >
            ${preset}
          </button>
        ))}
        <button
          onClick={() => setAmount(effectiveMax)}
          className="flex-1 py-2 bg-danger/10 text-danger rounded-full hover:bg-danger/20 border border-danger/30 transition-colors text-sm font-bold"
        >
          ALL IN
        </button>
      </div>

      <button
        onClick={() => onSubmit(amount)}
        className="w-full py-4 bg-text-primary text-white font-bold text-xl rounded-full hover:opacity-90 active:scale-95 transition-all"
      >
        Submit Wager
      </button>
    </div>
  );
}
