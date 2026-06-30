"use client";

export const THEMES = [
  { id: "light", label: "☀️ Light" },
  { id: "dark", label: "🌙 Dark" },
  { id: "midnight", label: "🌌 Midnight" },
  { id: "sunset", label: "🌅 Sunset" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "robot.theme";
const DEFAULT: ThemeId = "light";

export function getTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT;
  const t = localStorage.getItem(KEY) as ThemeId | null;
  return t && THEMES.some((x) => x.id === t) ? t : DEFAULT;
}

export function applyTheme(theme: ThemeId) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

export function setTheme(theme: ThemeId) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

// Inline script (stringified) that sets the theme before first paint to avoid a
// flash of the wrong theme. Injected in the document <head>.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"${DEFAULT}";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="${DEFAULT}";}})();`;
