"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";
import { confirmRoom, getName, setName as persistName } from "@/lib/identity";

export default function Landing() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getName());
  }, []);

  async function createRoom() {
    if (!name.trim()) return setError("Pick a name first!");
    setBusy(true);
    setError(null);
    persistName(name);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${name}'s room` }),
      });
      const { roomId } = await res.json();
      confirmRoom(roomId); // we just chose our name here, don't re-prompt in the room
      router.push(`/room/${roomId}`);
    } catch {
      setError("Couldn't reach the server. Is it running?");
      setBusy(false);
    }
  }

  function joinRoom() {
    if (!name.trim()) return setError("Pick a name first!");
    const id = code.trim().toLowerCase().replace(/.*\//, "");
    if (!id) return setError("Enter a room code or link.");
    persistName(name);
    confirmRoom(id); // chose name here too
    router.push(`/room/${id}`);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 text-6xl">🤖</div>
        <h1 className="bg-gradient-to-r from-indigo-300 via-cyan-200 to-indigo-300 bg-clip-text text-5xl font-black text-transparent">
          Robot Rush
        </h1>
        <p className="mt-3 max-w-md text-white/60">
          Ricochet Robots with your friends. Slide the robots, find the fewest
          moves, and race the countdown.
        </p>
      </div>

      <div className="panel w-full max-w-md p-6">
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-white/70">Your name</span>
          <input
            className="input text-lg"
            placeholder="e.g. David"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
            autoFocus
          />
        </label>

        <button
          className="btn btn-primary w-full text-lg"
          onClick={createRoom}
          disabled={busy}
        >
          {busy ? "Creating…" : "✨ Create a room"}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase text-white/30">
          <div className="h-px flex-1 bg-white/10" />
          or join one
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            className="input"
            placeholder="room code or link"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          />
          <button className="btn btn-ghost" onClick={joinRoom}>
            Join
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
      </div>

      <p className="mt-8 max-w-md text-center text-xs text-white/30">
        Everyone marks ready, then it&apos;s 3·2·1 and the board randomizes. First
        to a solution starts the clock — beat their move count before time runs
        out to steal the win.
      </p>
    </main>
  );
}
