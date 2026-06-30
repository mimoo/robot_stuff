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
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        grid.push({
          x,
          y,
          right: b.hasWall({ x, y }, "right") && x < SIZE - 1,
          bottom: b.hasWall({ x, y }, "down") && y < SIZE - 1,
          middle: b.inMiddleBox({ x, y }),
        });
      }
    }
    return grid;
  }, []);

  const target = puzzle?.target;
  const targetColor = puzzle ? ROBOT_HEX[puzzle.targetForRobot] : "#fff";
  const robotAt = useMemo(() => {
    const m = new Map<string, number>();
    robots.forEach((r, i) => m.set(`${r.x},${r.y}`, i));
    return m;
  }, [robots]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2">
      {/* board area: the board is the largest square that fits this box (cqmin).
          On small screens it's a width-driven square; on lg it fills the height. */}
      <div
        className="relative aspect-square w-full min-h-0 lg:aspect-auto lg:flex-1"
        style={{ containerType: "size" }}
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "100cqmin", height: "100cqmin" }}
        >
          <div
            className="grid h-full w-full overflow-hidden rounded-xl"
            style={{
              gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
              background: "#0e1426",
              border: "3px solid #3a4470",
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
                  background: c.middle
                    ? "#05070f"
                    : (c.x + c.y) % 2 === 0
                      ? "rgba(255,255,255,0.015)"
                      : "transparent",
                  boxShadow: [
                    c.right ? "inset -3px 0 0 #8ea0d8" : "",
                    c.bottom ? "inset 0 -3px 0 #8ea0d8" : "",
                  ]
                    .filter(Boolean)
                    .join(","),
                  cursor:
                    interactive && (robot != null || reach) ? "pointer" : "default",
                }}
              >
                {/* reachable target highlight */}
                {reach && (
                  <span
                    className="pointer-events-none absolute inset-[18%] rounded-full animate-float-in"
                    style={{
                      background: "rgba(250, 204, 21, 0.35)",
                      boxShadow: "0 0 10px 2px rgba(250,204,21,0.45)",
                    }}
                  />
                )}

                {/* target ring */}
                {isTarget && (
                  <span
                    className="target-ring pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ color: targetColor }}
                  >
                    <span
                      className="absolute rounded-full"
                      style={{
                        inset: "26%",
                        border: `2px solid ${targetColor}`,
                        boxShadow: `inset 0 0 6px ${targetColor}`,
                      }}
                    />
                  </span>
                )}

                {/* robot */}
                {robot != null && (
                  <span
                    className="absolute inset-[14%] flex items-center justify-center rounded-[28%] animate-pop"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${ROBOT_GLOW[robot]}, ${ROBOT_HEX[robot]})`,
                      boxShadow: isActiveRobot
                        ? `0 0 0 2px #fff, 0 0 14px 3px ${ROBOT_GLOW[robot]}`
                        : `0 2px 6px rgba(0,0,0,0.5)`,
                    }}
                  >
                    <span className="flex gap-[2px]">
                      <i className="block h-[14%] min-h-[2px] w-[14%] min-w-[2px] rounded-full bg-white/90" />
                      <i className="block h-[14%] min-h-[2px] w-[14%] min-w-[2px] rounded-full bg-white/90" />
                    </span>
                  </span>
                )}
              </div>
            );
          })}
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
      <div className="flex w-full max-w-[560px] shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-lg bg-white/5 px-3 py-1.5 font-mono">
            Your moves:{" "}
            <b className="text-base text-white">{moves.length}</b>
          </span>
          {championMoves != null && (
            <span className="rounded-lg bg-amber-400/10 px-3 py-1.5 text-amber-200">
              Beat: <b>{championMoves}</b>
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost"
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
