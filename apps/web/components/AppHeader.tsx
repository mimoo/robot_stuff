import Link from "next/link";
import ThemeSwitcher from "./ThemeSwitcher";

// Slim global brand bar shown on every page.
export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-[color:var(--color-edge)] bg-[color:var(--panel-b)]/70 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" title="Home">
          <span className="text-xl leading-none">🤖</span>
          <span className="bg-gradient-to-r from-indigo-300 via-cyan-200 to-indigo-300 bg-clip-text text-base font-extrabold tracking-tight text-transparent">
            Robot Rush
          </span>
        </Link>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
