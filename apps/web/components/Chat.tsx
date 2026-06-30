"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@robot/shared/protocol";

export default function Chat({
  messages,
  myId,
  onSend,
}: {
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="panel flex min-h-[220px] flex-1 flex-col p-3 lg:min-h-0">
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/60">
        Chat
      </h2>
      <div
        ref={scrollRef}
        className="scroll-thin mb-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1"
      >
        {messages.length === 0 && (
          <p className="px-1 text-sm text-white/30">
            Say hi to your friends 👋
          </p>
        )}
        {messages.map((m) =>
          m.system ? (
            <div
              key={m.id}
              className="px-1 text-center text-xs italic text-white/40"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className={`max-w-[88%] rounded-2xl px-3 py-1.5 text-sm ${
                m.playerId === myId
                  ? "self-end bg-indigo-500/30"
                  : "self-start bg-white/5"
              }`}
            >
              {m.playerId !== myId && (
                <div className="text-[11px] font-semibold text-white/50">
                  {m.name}
                </div>
              )}
              <div className="break-words">{m.text}</div>
            </div>
          ),
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input"
          placeholder="Message…"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
