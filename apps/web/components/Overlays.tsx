"use client";

import { useMemo } from "react";

// Shared wrapper for a board-covering overlay.
function Cover({
  children,
  bg = "rgba(3,5,12,0.92)",
}: {
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl text-center"
      style={{ background: bg, backdropFilter: "blur(2px)" }}
    >
      {children}
    </div>
  );
}

export function StartCountdown({
  endsAt,
  now,
}: {
  endsAt: number;
  now: number;
}) {
  const n = Math.ceil((endsAt - now) / 1000);
  const label = n <= 0 ? "GO!" : String(n);
  return (
    <Cover bg="rgba(8,11,26,0.8)">
      <div
        key={label}
        className="animate-pop text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]"
      >
        {label}
      </div>
      <p className="mt-3 text-sm uppercase tracking-widest text-white/50">
        Get ready…
      </p>
    </Cover>
  );
}

export function PenaltyOverlay({
  until,
  now,
}: {
  until: number;
  now: number;
}) {
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <Cover bg="#000">
      <div className="text-6xl">🔒</div>
      <div className="mt-3 text-2xl font-bold text-rose-300">Penalty</div>
      <p className="mt-1 max-w-xs text-sm text-white/50">
        Board hidden so you can&apos;t peek. Try again in
      </p>
      <div className="mt-2 font-mono text-5xl font-black text-white">
        {left}
      </div>
    </Cover>
  );
}

export function PausedOverlay() {
  return (
    <Cover bg="rgba(3,5,12,0.96)">
      <div className="text-6xl">⏸️</div>
      <div className="mt-3 text-2xl font-bold">Paused</div>
      <p className="mt-1 text-sm text-white/50">
        The host paused the game. Hang tight!
      </p>
    </Cover>
  );
}

export function WaitingOverlay({ text }: { text: string }) {
  return (
    <Cover bg="rgba(8,11,26,0.85)">
      <div className="mb-3 text-5xl">🤖</div>
      <div className="max-w-xs text-lg font-semibold text-white/80">{text}</div>
    </Cover>
  );
}

export function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#f43f5e", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#22d3ee"];
    return Array.from({ length: 80 }, (_, i) => {
      // deterministic pseudo-random from index (no SSR mismatch)
      const r = (n: number) => ((Math.sin(i * 99.13 + n) + 1) / 2);
      return {
        left: r(1) * 100,
        delay: r(2) * 0.8,
        dur: 1.8 + r(3) * 1.6,
        size: 6 + r(4) * 8,
        color: colors[i % colors.length],
        rot: r(5) * 360,
      };
    });
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-5vh",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            borderRadius: 2,
            animation: `fall ${p.dur}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
