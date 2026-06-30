"use client";

import { useState } from "react";
import type { Settings } from "@robot/shared/protocol";

export default function SettingsPanel({
  settings,
  editable,
  onChange,
}: {
  settings: Settings;
  editable: boolean;
  onChange: (s: Partial<Settings>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
      >
        <span>Game settings</span>
        <span className="flex items-center gap-2">
          {!open && (
            <span className="font-mono lowercase tracking-normal text-[var(--faint)]">
              {settings.countdownSeconds}s · {settings.penaltySeconds}s
            </span>
          )}
          <span
            className="transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          >
            ⌄
          </span>
        </span>
      </button>

      {!open ? null : (
        <div className="mt-3.5">
          <label className="mb-4 block">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm text-[var(--muted)]">
            Challenge countdown
          </span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {settings.countdownSeconds}s
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={180}
          step={5}
          value={settings.countdownSeconds}
          disabled={!editable}
          onChange={(e) =>
            onChange({ countdownSeconds: Number(e.target.value) })
          }
          className="w-full disabled:opacity-50"
          style={{ accentColor: "var(--accent)" }}
        />
        <p className="mt-1 text-xs text-[var(--faint)]">
          How long everyone has to beat the first solution.
        </p>
      </label>

      <label className="block">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm text-[var(--muted)]">Penalty time</span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {settings.penaltySeconds}s
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          value={settings.penaltySeconds}
          disabled={!editable}
          onChange={(e) => onChange({ penaltySeconds: Number(e.target.value) })}
          className="w-full disabled:opacity-50"
          style={{ accentColor: "var(--danger)" }}
        />
        <p className="mt-1 text-xs text-[var(--faint)]">
          Black-out time after a reset or a failed attempt during the countdown.
        </p>
      </label>

          {!editable && (
            <p className="mt-3 text-xs text-[var(--faint)]">
              Only the host can change settings, and only in the lobby.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
