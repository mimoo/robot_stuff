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
    <div className="flex min-h-[180px] flex-1 flex-col lg:min-h-0">
      <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Chat
      </h2>
      <div
        ref={scrollRef}
        className="scroll-thin mb-2.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1"
      >
        {messages.length === 0 && (
          <p className="px-1 text-sm text-[var(--faint)]">
            Say hi to your friends 👋
          </p>
        )}
        {messages.map((m) =>
          m.system ? (
            <div
              key={m.id}
              className="py-0.5 text-center text-xs text-[var(--faint)]"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[88%] rounded-2xl px-3 py-1.5 text-sm"
              style={
                m.playerId === myId
                  ? {
                      alignSelf: "flex-end",
                      background:
                        "color-mix(in oklab, var(--accent) 22%, transparent)",
                    }
                  : {
                      alignSelf: "flex-start",
                      background: "color-mix(in oklab, var(--fg) 6%, transparent)",
                    }
              }
            >
              {m.playerId !== myId && (
                <div className="text-[11px] font-semibold text-[var(--muted)]">
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
        <button className="btn btn-primary btn-sm" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
