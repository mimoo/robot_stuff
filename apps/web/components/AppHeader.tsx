import Link from "next/link";
import ThemeSwitcher from "./ThemeSwitcher";
import HowToPlay from "./HowToPlay";

// Slim global brand bar shown on every page.
export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-[color:var(--color-edge)] bg-[color:var(--panel-b)] backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          title="Home"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-sm"
            style={{
              background:
                "radial-gradient(120% 120% at 30% 25%, color-mix(in oklab, var(--accent) 75%, #fff), var(--accent))",
              boxShadow:
                "0 2px 8px -2px color-mix(in oklab, var(--accent) 70%, transparent)",
            }}
          >
            🤖
          </span>
          <span className="font-display text-base font-bold tracking-tight">
            Robot Rush
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <HowToPlay />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
