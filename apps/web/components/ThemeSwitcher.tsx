"use client";

import { useEffect, useState } from "react";
import { getTheme, setTheme, THEMES, type ThemeId } from "@/lib/theme";

export default function ThemeSwitcher() {
  const [theme, setLocal] = useState<ThemeId>("dark");

  useEffect(() => {
    setLocal(getTheme());
  }, []);

  function change(t: ThemeId) {
    setLocal(t);
    setTheme(t);
  }

  return (
    <label className="relative inline-flex items-center" title="Theme">
      <select
        className="btn btn-ghost cursor-pointer appearance-none pr-7"
        value={theme}
        onChange={(e) => change(e.target.value as ThemeId)}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-xs opacity-60">
        ▾
      </span>
    </label>
  );
}
