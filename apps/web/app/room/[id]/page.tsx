"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Move } from "@robot/shared/game";
import Board from "@/components/Board";
import Roster from "@/components/Roster";
import Chat from "@/components/Chat";
import SettingsPanel from "@/components/Settings";
import {
  Confetti,
  PausedOverlay,
  PenaltyOverlay,
  StartCountdown,
  WaitingOverlay,
} from "@/components/Overlays";
import {
  confirmRoom,
  getName,
  getPlayerId,
  isRoomConfirmed,
  setName as persistName,
} from "@/lib/identity";
import { useNow, useRoom } from "@/lib/useRoom";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();

  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  // Show a name step before joining a room we haven't confirmed yet this session.
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setPlayerId(getPlayerId());
    const n = getName();
    setName(n);
    setNameDraft(n);
    setConfirmed(isRoomConfirmed(roomId));
  }, [roomId]);

  function confirmName() {
    const n = nameDraft.trim();
    if (!n) return;
    persistName(n);
    setName(n);
    confirmRoom(roomId);
    setConfirmed(true);
  }

  // only connect once the player has confirmed their name for this room
  const api = useRoom(roomId, playerId, confirmed ? name : "");
  const now = useNow(200);
  const { state, status } = api;

  // ---- derived ----
  const me = state?.players.find((p) => p.id === playerId) ?? null;
  const isHost = state?.hostId === playerId;
  const phase = state?.phase ?? "lobby";
  const champion = state?.champion ?? null;
  const penalizedUntil = me?.penalizedUntil ?? null;
  const penaltyActive = penalizedUntil != null && penalizedUntil > now;
  const meGaveUp = me?.gaveUp ?? false;
  const isChampion = champion?.playerId === playerId;
  const boardLocked = penaltyActive || phase === "paused" || meGaveUp;

  // ---- confetti on round win ----
  const [confetti, setConfetti] = useState(false);
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current !== "roundEnd" && phase === "roundEnd") {
      setConfetti(true);
      const t = setTimeout(() => setConfetti(false), 4500);
      return () => clearTimeout(t);
    }
    prevPhase.current = phase;
  }, [phase]);

  // ---- transient toast from solution acks ----
  const [toast, setToast] = useState<string | null>(null);
  const lastAckAt = useRef(0);
  useEffect(() => {
    const ack = api.lastAck;
    if (!ack || ack.at === lastAckAt.current) return;
    lastAckAt.current = ack.at;
    if (!ack.accepted) return;
    setToast(
      ack.champion
        ? `🏆 New best — ${ack.moves} moves!`
        : `Solved in ${ack.moves} (not better)`,
    );
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [api.lastAck]);

  // ---- copy helpers (room id + share link) ----
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  function copyText(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    } catch {
      /* clipboard unavailable — value is still visible on screen */
    }
  }

  function copyId() {
    copyText(roomId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  }

  function copyLink() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/room/${roomId}`
        : "";
    copyText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ---- leave the room ----
  function leaveRoom() {
    api.leave();
    router.push("/");
  }

  // ---- challenge countdown ----
  const challengeLeft =
    phase === "challenge" && state?.countdownEndsAt
      ? Math.max(0, Math.ceil((state.countdownEndsAt - now) / 1000))
      : null;

  const submitSolution = (moves: Move[]) => api.submitSolution(moves);

  // ---- name step (pick / confirm your name before joining this room) ----
  if (playerId && !confirmed) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col items-center justify-center px-6">
        <div className="panel w-full p-6 text-center">
          <div className="mb-2 text-5xl">🤖</div>
          <h1 className="mb-1 text-2xl font-bold">Joining a room</h1>
          <p className="mb-4 text-sm text-white/50">
            Choose your name for room{" "}
            <span className="font-mono">{roomId}</span>
          </p>
          <input
            className="input mb-3 text-lg"
            placeholder="Your name"
            value={nameDraft}
            maxLength={20}
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
          />
          <button
            className="btn btn-primary w-full"
            disabled={!nameDraft.trim()}
            onClick={confirmName}
          >
            Join as {nameDraft.trim() || "…"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col px-4 py-3 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      {confetti && <Confetti />}

      {/* room bar */}
      <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {state?.name ?? "Robot Room"}
            </h1>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background:
                    status === "open"
                      ? "#22c55e"
                      : status === "connecting"
                        ? "#f59e0b"
                        : "#ef4444",
                }}
              />
              {status === "open"
                ? `Round ${state?.round ?? 0}`
                : status === "connecting"
                  ? "connecting…"
                  : "reconnecting…"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost font-mono text-sm tracking-widest"
            onClick={copyId}
            title="Copy room ID"
          >
            {copiedId ? "✓ Copied" : <>{roomId} ⧉</>}
          </button>
          <button className="btn btn-ghost" onClick={copyLink}>
            {copied ? "✓ Copied!" : "🔗 Share link"}
          </button>
          {isHost && (phase === "open" || phase === "challenge") && (
            <button className="btn btn-ghost" onClick={api.pause}>
              ⏸ Pause
            </button>
          )}
          {isHost && phase === "paused" && (
            <button className="btn btn-primary" onClick={api.resume}>
              ▶ Resume
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={leaveRoom}
            title="Leave this room and go back home"
          >
            🚪 Leave
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:flex-1 lg:grid-cols-[1fr_320px]">
        {/* left: board + status */}
        <section className="flex min-h-0 flex-col gap-2">
          {/* status strip */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="min-h-[2.5rem]">
              {champion ? (
                <div className="champ-banner flex items-center gap-2 rounded-xl border border-amber-400/30 px-4 py-2">
                  <span className="text-xl">🏆</span>
                  <span className="font-semibold">
                    Best: <b className="text-amber-200">{champion.moves}</b> moves
                    by {champion.name}
                  </span>
                </div>
              ) : phase === "open" ? (
                <div className="rounded-xl bg-white/5 px-4 py-2 text-white/70">
                  🎯 Find a solution! Slide the matching robot onto the target.
                </div>
              ) : null}
            </div>

            {challengeLeft != null && (
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-3xl font-black tabular-nums ${
                  challengeLeft <= 10
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-white/5 text-white"
                }`}
              >
                ⏱{" "}
                {String(Math.floor(challengeLeft / 60)).padStart(1, "0")}:
                {String(challengeLeft % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          {/* board (fills remaining height) with overlays aligned to it */}
          <Board
            puzzle={state?.puzzle ?? null}
            phase={phase}
            championMoves={champion?.moves ?? null}
            locked={boardLocked}
            onSolved={submitSolution}
            onPenalty={(reason) => api.reportPenalty(reason)}
          >
            {phase === "paused" && <PausedOverlay />}
            {phase !== "paused" && penaltyActive && (
              <PenaltyOverlay until={penalizedUntil!} now={now} />
            )}
            {phase !== "paused" &&
              !penaltyActive &&
              phase === "starting" &&
              state?.startCountdownEndsAt && (
                <StartCountdown endsAt={state.startCountdownEndsAt} now={now} />
              )}
            {phase !== "paused" && !penaltyActive && phase === "lobby" && (
              <WaitingOverlay text="Waiting for everyone to ready up…" />
            )}
            {phase !== "paused" &&
              !penaltyActive &&
              meGaveUp &&
              (phase === "open" || phase === "challenge") && (
                <WaitingOverlay text="🏳️ You gave up — waiting for the round to end." />
              )}
          </Board>

          {/* control bar */}
          <div className="shrink-0">
            <ControlBar
              phase={phase}
              isHost={isHost}
              ready={me?.ready ?? false}
              gaveUp={meGaveUp}
              isChampion={isChampion}
              onReady={(r) => api.setReady(r)}
              onStart={api.startGame}
              onNextRound={api.nextRound}
              onGiveUp={api.giveUp}
            />
          </div>
        </section>

        {/* right: roster, settings, chat */}
        <aside className="flex min-h-0 flex-col gap-3 lg:overflow-hidden">
          {state && (
            <Roster
              players={state.players}
              myId={playerId}
              phase={phase}
              champion={champion}
              now={now}
            />
          )}

          {state && phase === "lobby" && (
            <SettingsPanel
              settings={state.settings}
              editable={isHost}
              onChange={(s) => api.updateSettings(s)}
            />
          )}

          {state && (
            <Chat messages={api.chat} myId={playerId} onSend={api.sendChat} />
          )}
        </aside>
      </div>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div className="animate-pop rounded-full bg-indigo-500/90 px-5 py-2.5 font-semibold shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}

function ControlBar({
  phase,
  isHost,
  ready,
  gaveUp,
  isChampion,
  onReady,
  onStart,
  onNextRound,
  onGiveUp,
}: {
  phase: string;
  isHost: boolean;
  ready: boolean;
  gaveUp: boolean;
  isChampion: boolean;
  onReady: (r: boolean) => void;
  onStart: () => void;
  onNextRound: () => void;
  onGiveUp: () => void;
}) {
  // a player can concede while a round is live (the champion has no reason to)
  const giveUpBtn =
    (phase === "open" || phase === "challenge") && !isChampion ? (
      <button
        className="btn btn-ghost"
        onClick={onGiveUp}
        disabled={gaveUp}
        title="Stop trying this round. If everyone gives up, the round ends now."
      >
        {gaveUp ? "🏳️ Gave up" : "🏳️ Give up"}
      </button>
    ) : null;

  if (phase === "lobby") {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-white/60">
          Mark ready when you&apos;re set. The game starts when everyone&apos;s
          ready.
        </p>
        <div className="flex gap-2">
          {isHost && (
            <button className="btn btn-ghost" onClick={onStart}>
              Start now
            </button>
          )}
          <button
            className={`btn ${ready ? "btn-ghost" : "btn-ready"}`}
            onClick={() => onReady(!ready)}
          >
            {ready ? "✓ Ready (cancel)" : "I'm ready!"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "roundEnd") {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-white/60">Round over! 🎉</p>
        {isHost ? (
          <button className="btn btn-primary" onClick={onNextRound}>
            ▶ Next round
          </button>
        ) : (
          <span className="text-sm text-white/40">
            Waiting for host to start the next round…
          </span>
        )}
      </div>
    );
  }

  if (phase === "challenge") {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-white/60">
          ⚡ Beat the best move count before time runs out! Reset or running out
          of moves during the countdown costs you a penalty.
        </p>
        {giveUpBtn}
      </div>
    );
  }

  if (phase === "open") {
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-white/60">
          🎯 Race to find a solution — the first one starts the countdown.
        </p>
        {giveUpBtn}
      </div>
    );
  }

  return null;
}
