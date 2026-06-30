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
    <div className="panel flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">
          Players
        </h2>
        <span className="text-xs text-white/40">{players.length} in room</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {sorted.map((p) => {
          const penalized = p.penalizedUntil != null && p.penalizedUntil > now;
          const penaltyLeft = penalized
            ? Math.ceil((p.penalizedUntil! - now) / 1000)
            : 0;
          const isChamp = champion?.playerId === p.id;
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
              style={{
                background: isChamp
                  ? "rgba(250,204,21,0.10)"
                  : "rgba(255,255,255,0.03)",
                outline:
                  p.id === myId ? "1px solid rgba(99,102,241,0.55)" : "none",
              }}
            >
              <span
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black/80"
                style={{ background: p.color }}
              >
                {p.name.slice(0, 1).toUpperCase()}
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#141a2e]"
                  style={{ background: p.connected ? "#22c55e" : "#64748b" }}
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">
                    {p.name}
                    {p.id === myId && (
                      <span className="text-white/40"> (you)</span>
                    )}
                  </span>
                  {p.isHost && <span title="Host">👑</span>}
                  {isChamp && <span title="Current champion">🏆</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  {phase === "lobby" ? (
                    <span className={p.ready ? "text-emerald-400" : ""}>
                      {p.ready ? "✓ ready" : "not ready"}
                    </span>
                  ) : penalized ? (
                    <span className="text-rose-400">🔒 {penaltyLeft}s</span>
                  ) : p.gaveUp ? (
                    <span className="text-white/40">🏳️ gave up</span>
                  ) : p.solved ? (
                    <span className="text-emerald-400">✓ solved</span>
                  ) : (
                    <span>thinking…</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-extrabold leading-none">
                  {p.score}
                </div>
                <div className="text-[10px] uppercase text-white/40">wins</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
