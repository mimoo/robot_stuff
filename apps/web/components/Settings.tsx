"use client";

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
  return (
    <div className="panel p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/60">
        Game settings
      </h2>

      <label className="mb-4 block">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm text-white/70">Challenge countdown</span>
          <span className="font-mono text-lg font-bold text-white">
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
          className="w-full accent-indigo-500 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-white/40">
          How long everyone has to beat the first solution.
        </p>
      </label>

      <label className="block">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm text-white/70">Penalty time</span>
          <span className="font-mono text-lg font-bold text-white">
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
          className="w-full accent-rose-500 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-white/40">
          Black-out time after a reset or a failed attempt during the countdown.
        </p>
      </label>

      {!editable && (
        <p className="mt-3 text-xs text-white/40">
          Only the host can change settings, and only in the lobby.
        </p>
      )}
    </div>
  );
}
