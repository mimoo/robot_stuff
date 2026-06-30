"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Move } from "@robot/shared/game";
import type {
  ChatMessage,
  ClientMessage,
  RoomState,
  ServerMessage,
  Settings,
} from "@robot/shared/protocol";
import { WS_URL } from "./config";

export type ConnStatus = "connecting" | "open" | "closed";

export type SolutionAck = {
  accepted: boolean;
  moves: number;
  champion: boolean;
  at: number;
};

export type RoomApi = {
  status: ConnStatus;
  state: RoomState | null;
  chat: ChatMessage[];
  lastAck: SolutionAck | null;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  nextRound: () => void;
  pause: () => void;
  resume: () => void;
  submitSolution: (moves: Move[]) => void;
  reportPenalty: (reason: "reset" | "exhausted") => void;
  giveUp: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  sendChat: (text: string) => void;
  leave: () => void;
};

export function useRoom(
  roomId: string,
  playerId: string,
  name: string,
): RoomApi {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [state, setState] = useState<RoomState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [lastAck, setLastAck] = useState<SolutionAck | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!roomId || !playerId || !name) return;
    // `cancelled` is local to THIS effect run, so a socket torn down by an
    // earlier run (e.g. React StrictMode's double-mount) can never schedule a
    // reconnect that races the current one — which would create a 2nd seat.
    let cancelled = false;
    let socket: WebSocket | null = null;
    let attempts = 0;

    const connect = () => {
      const url = `${WS_URL}/ws?room=${encodeURIComponent(roomId)}&pid=${encodeURIComponent(
        playerId,
      )}&name=${encodeURIComponent(name || "Player")}`;
      const ws = new WebSocket(url);
      socket = ws;
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attempts = 0;
        setStatus("open");
      };

      ws.onmessage = (e) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        switch (msg.t) {
          case "roomState":
            setState(msg.state);
            break;
          case "chatHistory":
            setChat(msg.messages);
            break;
          case "chatMessage":
            setChat((prev) => [...prev, msg.message]);
            break;
          case "solutionAck":
            setLastAck({
              accepted: msg.accepted,
              moves: msg.moves,
              champion: msg.champion,
              at: Date.now(),
            });
            break;
          case "error":
            console.warn("server error:", msg.message);
            break;
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus("closed");
        // exponential-ish backoff reconnect
        attempts += 1;
        const delay = Math.min(500 * attempts, 4000);
        retryRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      socket?.close();
    };
  }, [roomId, playerId, name]);

  return {
    status,
    state,
    chat,
    lastAck,
    setReady: (ready) => send({ t: "setReady", ready }),
    startGame: () => send({ t: "startGame" }),
    nextRound: () => send({ t: "nextRound" }),
    pause: () => send({ t: "pause" }),
    resume: () => send({ t: "resume" }),
    submitSolution: (moves) => send({ t: "submitSolution", moves }),
    reportPenalty: (reason) => send({ t: "reportPenalty", reason }),
    giveUp: () => send({ t: "giveUp" }),
    updateSettings: (settings) => send({ t: "updateSettings", settings }),
    sendChat: (text) => send({ t: "chat", text }),
    leave: () => send({ t: "leave" }),
  };
}

// Ticking "now" for smooth client-side countdowns. Pass an interval in ms.
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
