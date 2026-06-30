"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Board as GameBoard,
  DIRECTIONS,
  SIZE,
  type Direction,
  type Move,
  type Puzzle,
  type Tile,
} from "@robot/shared/game";
import type { Phase } from "@robot/shared/protocol";

const ROBOT_HEX = ["#f43f5e", "#3b82f6", "#22c55e", "#a855f7"];
const ROBOT_GLOW = ["#fb7185", "#60a5fa", "#4ade80", "#c084fc"];

type Reachable = { tile: Tile; dir: Direction };

function puzzleKey(p: Puzzle): string {
  return (
    p.robotStarts.map((t) => `${t.x},${t.y}`).join("|") +
    `>${p.target.x},${p.target.y}@${p.targetForRobot}`
  );
}

export default function Board({
  puzzle,
  phase,
  championMoves,
  locked,
  onSolved,
  onPenalty,
  children,
}: {
  puzzle: Puzzle | null;
  phase: Phase;
  championMoves: number | null;
  locked: boolean;
  onSolved: (moves: Move[]) => void;
  onPenalty: (reason: "reset" | "exhausted") => void;
  children?: React.ReactNode;
}) {
  const boardRef = useRef<GameBoard | null>(null);
  const [robots, setRobots] = useState<Tile[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const interactive =
    !locked && puzzle != null && (phase === "open" || phase === "challenge");

  // (Re)build the local attempt board whenever the puzzle changes.
  const key = puzzle ? puzzleKey(puzzle) : "none";
  useEffect(() => {
    if (!puzzle) {
      boardRef.current = null;
      setRobots([]);
      setMoves([]);
      setActive(null);
      return;
    }
    const b = new GameBoard();
    b.init_default();
    b.loadPuzzle(puzzle);
    boardRef.current = b;
    setRobots(b.robots.map((t) => ({ ...t })));
    setMoves([]);
    setActive(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Reset the local attempt back to the puzzle start (used after penalty/solve).
  const resetAttempt = (silent = false) => {
    const b = boardRef.current;
    if (!b) return;
    b.reset();
    setRobots(b.robots.map((t) => ({ ...t })));
    setMoves([]);
    setActive(null);
    if (!silent) setFlash(null);
  };

  const reachable: Reachable[] = useMemo(() => {
    const b = boardRef.current;
    if (b == null || active == null || !interactive) return [];
    const out: Reachable[] = [];
    for (const dir of DIRECTIONS) {
      const dest = b.slide(active, dir);
      if (dest) out.push({ tile: dest, dir });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, robots, interactive]);

  const reachableMap = useMemo(() => {
    const m = new Map<string, Direction>();
    for (const r of reachable) m.set(`${r.tile.x},${r.tile.y}`, r.dir);
    return m;
  }, [reachable]);

  function handleRobotClick(idx: number) {
    if (!interactive) return;
    setActive((cur) => (cur === idx ? null : idx));
  }

  function handleTileClick(x: number, y: number) {
    if (!interactive || active == null) return;
    const dir = reachableMap.get(`${x},${y}`);
    if (!dir) return;
    const b = boardRef.current!;
    const won = b.moveRobot(active, { x, y });
    const nextMoves = [...moves, { robot: active, dir }];
    setRobots(b.robots.map((t) => ({ ...t })));
    setMoves(nextMoves);

    if (won) {
      onSolved(nextMoves);
      setFlash(`Solved in ${nextMoves.length}!`);
      // let them immediately try again for fewer moves
      window.setTimeout(() => resetAttempt(true), 60);
      setActive(null);
      return;
    }

    setActive(active); // keep selected so they can chain moves
    // exhausted: hit the champion's move count without solving → penalty
    if (
      phase === "challenge" &&
      championMoves != null &&
      nextMoves.length >= championMoves
    ) {
      onPenalty("exhausted");
      resetAttempt(true);
    }
  }

  function handleReset() {
    if (!puzzle) return;
    if (phase === "challenge") onPenalty("reset");
    resetAttempt();
  }

  // Static cell geometry (walls) — only depends on the default board layout.
  const cells = useMemo(() => {
    const b = new GameBoard();
    b.init_default();
    const grid: {
      x: number;
      y: number;
      right: boolean;
      bottom: boolean;
      middle: boolean;
    }[] = [];
    const inBox = (x: number, y: number) => b.inMiddleBox({ x, y });
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        grid.push({
          x,
          y,
          // suppress wall lines that touch the center box — it's drawn as one
          // clean bordered square instead (avoids doubled/offset bars)
          right:
            b.hasWall({ x, y }, "right") &&
            x < SIZE - 1 &&
            !inBox(x, y) &&
            !inBox(x + 1, y),
          bottom:
            b.hasWall({ x, y }, "down") &&
            y < SIZE - 1 &&
            !inBox(x, y) &&
            !inBox(x, y + 1),
          middle: b.inMiddleBox({ x, y }),
        });
      }
    }
    return grid;
  }, []);

  const target = puzzle?.target;
  const targetColor = puzzle ? ROBOT_HEX[puzzle.targetForRobot] : "#fff";
  const reachColor = active != null ? ROBOT_GLOW[active] : "var(--accent)";
  const robotAt = useMemo(() => {
    const m = new Map<string, number>();
    robots.forEach((r, i) => m.set(`${r.x},${r.y}`, i));
    return m;
  }, [robots]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2.5">
      {/* the board is the largest square that fits this area (cqmin), centered.
          The section gives this area a definite size so the column hugs it. */}
      <div
        className="relative aspect-square w-full min-h-0 lg:aspect-auto lg:flex-1"
        style={{ containerType: "size" }}
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "100cqmin", height: "100cqmin" }}
        >
          <div
            className="relative grid h-full w-full overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
              background: "var(--board-bg)",
              borderRadius: "16px",
              border: "1px solid var(--edge-strong)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 40px 80px -50px rgba(0,0,0,0.85)",
            }}
          >
          {cells.map((c) => {
            const id = `${c.x},${c.y}`;
            const robot = robotAt.get(id);
            const isTarget =
              target && target.x === c.x && target.y === c.y;
            const reach = reachableMap.get(id);
            const isActiveRobot = robot != null && robot === active;
            return (
              <div
                key={id}
                onClick={() =>
                  robot != null
                    ? handleRobotClick(robot)
                    : handleTileClick(c.x, c.y)
                }
                className="relative"
                style={{
                  background:
                    !c.middle && (c.x + c.y) % 2 === 0
                      ? "color-mix(in oklab, var(--fg) 3%, transparent)"
                      : "transparent",
                  boxShadow: [
                    c.right ? "inset -2px 0 0 var(--wall)" : "",
                    c.bottom ? "inset 0 -2px 0 var(--wall)" : "",
                  ]
                    .filter(Boolean)
                    .join(","),
                  cursor:
                    interactive && (robot != null || reach) ? "pointer" : "default",
                }}
              >
                {/* reachable destination — soft dot in the active robot's color */}
                {reach && (
                  <span
                    className="pointer-events-none absolute inset-[34%] rounded-full animate-fade"
                    style={{
                      background: reachColor,
                      boxShadow: `0 0 12px 3px ${reachColor}`,
                      opacity: 0.85,
                    }}
                  />
                )}

                {/* target reticle */}
                {isTarget && (
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ color: targetColor }}
                  >
                    <span
                      className="absolute rounded-full"
                      style={{ inset: "20%", border: "1.5px solid currentColor", opacity: 0.3 }}
                    />
                    <span
                      className="absolute rounded-full"
                      style={{
                        inset: "20%",
                        border: "1.5px solid currentColor",
                        animation: "pulse-ring 1.9s ease-out infinite",
                      }}
                    />
                    <span
                      className="absolute rounded-full"
                      style={{ inset: "40%", background: "currentColor" }}
                    />
                  </span>
                )}

                {/* robot — glossy disc with a cheeky little face */}
                {robot != null && (
                  <span
                    className="absolute inset-[13%] flex items-center justify-center rounded-[32%] animate-pop"
                    style={{
                      background: `radial-gradient(125% 125% at 32% 24%, ${ROBOT_GLOW[robot]}, ${ROBOT_HEX[robot]} 58%, color-mix(in oklab, ${ROBOT_HEX[robot]} 62%, #000) 100%)`,
                      boxShadow: isActiveRobot
                        ? `0 0 0 2px var(--board-bg), 0 0 0 3.5px ${ROBOT_GLOW[robot]}, 0 8px 16px -5px rgba(0,0,0,0.7)`
                        : `inset 0 1px 1.5px rgba(255,255,255,0.4), 0 5px 12px -4px rgba(0,0,0,0.7)`,
                    }}
                  >
                    {/* specular highlight */}
                    <span
                      className="absolute rounded-full"
                      style={{
                        top: "11%",
                        left: "18%",
                        width: "30%",
                        height: "22%",
                        background: "rgba(255,255,255,0.6)",
                        filter: "blur(1.2px)",
                      }}
                    />
                    {/* googly eyes */}
                    <span className="flex items-center gap-[12%]">
                      {[0, 1].map((i) => (
                        <span
                          key={i}
                          className="relative flex items-center justify-center rounded-full bg-white"
                          style={{
                            width: "26%",
                            minWidth: "4px",
                            aspectRatio: "1",
                            boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.15)",
                          }}
                        >
                          <span
                            className="rounded-full bg-[#10131c]"
                            style={{
                              width: "46%",
                              aspectRatio: "1",
                              transform:
                                active != null && isActiveRobot
                                  ? "translateY(8%)"
                                  : "none",
                            }}
                          />
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </div>
            );
          })}

            {/* the fixed center 2x2 box, drawn as one fully-closed bordered
                square (7/16..9/16 of the cell area; absolute so it doesn't
                disturb the grid's auto-placement) */}
            <div
              className="pointer-events-none absolute"
              style={{
                left: "43.75%",
                top: "43.75%",
                width: "12.5%",
                height: "12.5%",
                background: "color-mix(in oklab, var(--board-bg) 80%, #000)",
                borderRadius: "4px",
                boxShadow: "inset 0 0 0 2px var(--wall)",
              }}
            />
          </div>

          {flash && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="animate-pop rounded-2xl bg-emerald-500/90 px-6 py-3 text-xl font-extrabold text-emerald-950 shadow-2xl">
                {flash}
              </div>
            </div>
          )}

          {/* phase overlays (penalty / paused / 3-2-1 / waiting), aligned to the board */}
          {children}
        </div>
      </div>

      {/* attempt HUD */}
      <div className="flex w-full shrink-0 items-center justify-between gap-3 px-1 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-[var(--muted)]">
            moves{" "}
            <b className="ml-0.5 font-mono text-base text-[var(--fg)] tabular-nums">
              {moves.length}
            </b>
          </span>
          {championMoves != null && (
            <span className="text-[var(--muted)]">
              · beat{" "}
              <b className="font-mono text-[var(--accent)] tabular-nums">
                {championMoves}
              </b>
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleReset}
          disabled={!interactive || moves.length === 0}
          title={
            phase === "challenge"
              ? "Resetting during the countdown costs you a penalty!"
              : "Reset your robots"
          }
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
