"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SEEN_KEY = "robot.seenTutorial";

const STEPS: { color: string; title: string; body: string }[] = [
  {
    color: "#ff5a6b",
    title: "Slide robots to the target",
    body: "Each round one robot has a matching coloured target. Get that robot onto its target to solve the puzzle.",
  },
  {
    color: "#4f8cff",
    title: "They glide until they hit something",
    body: "Click a robot, then click a highlighted tile. Robots slide in a straight line until a wall or another robot stops them — there are no half-steps.",
  },
  {
    color: "#f6c453",
    title: "Fewest moves wins",
    body: "The first solver sets the score to beat and starts a countdown. Find a solution in fewer moves before time runs out to steal the lead — the count beat does not reset the clock.",
  },
  {
    color: "#45dca0",
    title: "Mind the penalty",
    body: "During the countdown, resetting or running out of moves (you can't beat the best anymore) blacks out your board for a few seconds.",
  },
];

export default function HowToPlay() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // auto-open once for first-time visitors (and mark mounted for the portal)
  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {}
  }, []);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(true)}
        title="How to play"
      >
        <span aria-hidden>?</span>
        <span className="hidden sm:inline">How to play</span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="animate-fade fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(4,5,8,0.6)", backdropFilter: "blur(4px)" }}
            onClick={close}
          >
          <div
            className="panel animate-rise w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="font-display text-xl font-bold">How to play</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={close}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="px-5 pt-1 text-sm text-[var(--muted)]">
              Robot Rush is Ricochet Robots, raced against your friends.
            </p>

            <ol className="flex flex-col gap-3.5 p-5">
              {STEPS.map((s, i) => (
                <li key={i} className="flex gap-3.5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-sm font-bold text-black/80"
                    style={{
                      background: `radial-gradient(120% 120% at 32% 24%, color-mix(in oklab, ${s.color} 70%, #fff), ${s.color})`,
                      boxShadow: "0 2px 6px -2px rgba(0,0,0,0.4)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{s.title}</div>
                    <div className="mt-0.5 text-sm leading-snug text-[var(--muted)]">
                      {s.body}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="hairline flex justify-end border-t p-4">
              <button className="btn btn-primary" onClick={close}>
                Let&apos;s play →
              </button>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
