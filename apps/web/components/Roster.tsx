"use client";

import type { Champion, Phase, PublicPlayer } from "@robot/shared/protocol";

export default function Roster({
  players,
  myId,
  phase,
  champion,
  now,
}: {
  players: PublicPlayer[];
  myId: string;
  phase: Phase;
  champion: Champion | null;
  now: number;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="flex flex-col">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Players
        </h2>
        <span className="text-xs text-[var(--faint)]">
          {players.length} in room
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {sorted.map((p) => {
          const penalized = p.penalizedUntil != null && p.penalizedUntil > now;
          const penaltyLeft = penalized
            ? Math.ceil((p.penalizedUntil! - now) / 1000)
            : 0;
          const isChamp = champion?.playerId === p.id;
          const isMe = p.id === myId;
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-opacity"
              style={{
                background: isChamp
                  ? "color-mix(in oklab, var(--accent) 12%, transparent)"
                  : isMe
                    ? "color-mix(in oklab, var(--fg) 5%, transparent)"
                    : "transparent",
                boxShadow: isChamp
                  ? "inset 0 0 0 1px color-mix(in oklab, var(--accent) 35%, transparent)"
                  : "none",
                opacity: p.connected ? 1 : 0.5,
              }}
            >
              <span
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold text-black/80"
                style={{
                  background: `radial-gradient(120% 120% at 32% 24%, color-mix(in oklab, ${p.color} 70%, #fff), ${p.color})`,
                  boxShadow: "0 2px 6px -2px rgba(0,0,0,0.5)",
                }}
              >
                {p.name.slice(0, 1).toUpperCase()}
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                  style={{
                    background: p.connected ? "var(--success)" : "#6b7280",
                    boxShadow: "0 0 0 2px var(--panel-b, #14161e)",
                  }}
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {p.name}
                    {isMe && <span className="text-[var(--faint)]"> · you</span>}
                  </span>
                  {p.isHost && (
                    <span title="Host" className="text-xs">
                      👑
                    </span>
                  )}
                  {isChamp && (
                    <span
                      title="Current champion"
                      className="text-[var(--accent)]"
                    >
                      ★
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  {!p.connected ? (
                    <span style={{ color: "var(--accent)" }}>away</span>
                  ) : phase === "lobby" ? (
                    <span style={{ color: p.ready ? "var(--success)" : undefined }}>
                      {p.ready ? "ready" : "not ready"}
                    </span>
                  ) : penalized ? (
                    <span style={{ color: "var(--danger)" }}>
                      🔒 {penaltyLeft}s
                    </span>
                  ) : p.gaveUp ? (
                    <span className="text-[var(--faint)]">gave up</span>
                  ) : p.solved ? (
                    <span style={{ color: "var(--success)" }}>solved</span>
                  ) : (
                    <span>thinking…</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-lg font-bold leading-none tabular-nums">
                  {p.score}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
                  wins
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
