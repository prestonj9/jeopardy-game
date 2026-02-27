"use client";

const CONFETTI_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export interface ConfettiBurst {
  id: number;
  playerName: string;
  x: number; // 0-100 (percentage across screen)
}

interface BurstConfettiProps {
  bursts: ConfettiBurst[];
}

export default function BurstConfetti({ bursts }: BurstConfettiProps) {
  if (bursts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {/* Player name label */}
          <div
            className="absolute animate-confetti-name font-bold text-sm text-text-primary whitespace-nowrap"
            style={{
              left: `${burst.x}%`,
              top: "38%",
            }}
          >
            {burst.playerName} 🎉
          </div>

          {/* Burst particles */}
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i / 18) * 360 + (Math.random() - 0.5) * 40;
            const distance = 60 + Math.random() * 100;
            const bx = Math.cos((angle * Math.PI) / 180) * distance;
            const by = Math.sin((angle * Math.PI) / 180) * distance;
            const rotation = (Math.random() - 0.5) * 720;
            const size = 5 + Math.random() * 8;

            return (
              <div
                key={i}
                className="absolute animate-confetti-burst"
                style={{
                  left: `${burst.x}%`,
                  top: "40%",
                  backgroundColor: CONFETTI_COLORS[i % 6],
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                  "--bx": `${bx}px`,
                  "--by": `${by}px`,
                  "--br": `${rotation}deg`,
                  animationDelay: `${Math.random() * 0.1}s`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
