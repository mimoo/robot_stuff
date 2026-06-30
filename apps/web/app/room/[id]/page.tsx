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
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[1400px] flex-col px-4 py-2.5 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      {confetti && <Confetti />}

      {/* room bar */}
      <header className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold leading-none">
            {state?.name ?? "Robot Room"}
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  status === "open"
                    ? "var(--success)"
                    : status === "connecting"
                      ? "var(--accent)"
                      : "var(--danger)",
              }}
            />
            {status === "open"
              ? `Round ${state?.round ?? 0}`
              : status === "connecting"
                ? "connecting…"
                : "reconnecting…"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="chip cursor-pointer font-mono tracking-wider transition-colors hover:text-[var(--fg)]"
            onClick={copyId}
            title="Copy room code"
          >
            {copiedId ? "copied ✓" : (
              <>
                {roomId}
                <span className="opacity-40">⧉</span>
              </>
            )}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={copyLink}>
            {copied ? "✓ link" : "Share"}
          </button>
          {isHost && (phase === "open" || phase === "challenge") && (
            <button className="btn btn-ghost btn-sm" onClick={api.pause}>
              Pause
            </button>
          )}
          {isHost && phase === "paused" && (
            <button className="btn btn-primary btn-sm" onClick={api.resume}>
              Resume
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={leaveRoom}
            title="Leave this room and go back home"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-col gap-4 lg:flex-1 lg:flex-row lg:justify-center lg:gap-5">
        {/* left: board + status. The width tracks the available board *height*
            so the square hugs its column (no side gaps) while still filling the
            height (no top/bottom gaps); it's only capped to avoid horizontal
            overflow. cqmin inside guarantees the board never overflows. */}
        <section className="flex min-h-0 w-full flex-col gap-2.5 lg:w-[calc(100dvh_-_17.5rem)] lg:max-w-[min(1020px,calc(100vw_-_25rem))]">
          {/* status strip */}
          <div className="flex h-9 shrink-0 items-center justify-between gap-3">
            <div className="min-w-0">
              {champion ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base text-[var(--accent)]">★</span>
                  <span className="truncate">
                    <span className="text-[var(--muted)]">best</span>{" "}
                    <b className="font-mono text-[var(--accent)] tabular-nums">
                      {champion.moves}
                    </b>{" "}
                    <span className="text-[var(--muted)]">by</span>{" "}
                    <span className="font-medium">{champion.name}</span>
                  </span>
                </div>
              ) : phase === "open" ? (
                <span className="text-sm text-[var(--muted)]">
                  Slide the matching robot onto the target.
                </span>
              ) : null}
            </div>

            {challengeLeft != null && (
              <div
                className="flex items-center gap-1.5 font-mono text-2xl font-semibold tabular-nums transition-colors"
                style={{
                  color: challengeLeft <= 10 ? "var(--danger)" : "var(--fg)",
                }}
              >
                <span className="text-sm text-[var(--muted)]">⏱</span>
                {Math.floor(challengeLeft / 60)}:
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

        {/* right: roster, settings, chat — one cohesive panel */}
        <aside className="panel flex min-h-0 w-full flex-col overflow-hidden lg:w-[340px] lg:shrink-0">
          {state && (
            <div className="shrink-0 p-3.5">
              <Roster
                players={state.players}
                myId={playerId}
                phase={phase}
                champion={champion}
                now={now}
              />
            </div>
          )}

          {state && phase === "lobby" && (
            <div className="hairline shrink-0 border-t p-3.5">
              <SettingsPanel
                settings={state.settings}
                editable={isHost}
                onChange={(s) => api.updateSettings(s)}
              />
            </div>
          )}

          {state && (
            <div className="hairline flex min-h-0 flex-1 flex-col border-t p-3.5">
              <Chat messages={api.chat} myId={playerId} onSend={api.sendChat} />
            </div>
          )}
        </aside>
      </div>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div
            className="animate-rise rounded-full px-5 py-2.5 text-sm font-semibold shadow-2xl"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
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
        className="btn btn-ghost btn-sm"
        onClick={onGiveUp}
        disabled={gaveUp}
        title="Stop trying this round. If everyone gives up, the round ends now."
      >
        {gaveUp ? "Gave up" : "Give up"}
      </button>
    ) : null;

  const shell =
    "panel flex flex-wrap items-center justify-between gap-3 px-4 py-3";

  if (phase === "lobby") {
    return (
      <div className={shell}>
        <p className="text-sm text-[var(--muted)]">
          Mark ready — the game starts when everyone&apos;s set.
        </p>
        <div className="flex gap-2">
          {isHost && (
            <button className="btn btn-ghost btn-sm" onClick={onStart}>
              Start now
            </button>
          )}
          <button
            className={`btn btn-sm ${ready ? "btn-ghost" : "btn-ready"}`}
            onClick={() => onReady(!ready)}
          >
            {ready ? "✓ Ready (cancel)" : "I'm ready"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "roundEnd") {
    return (
      <div className={shell}>
        <p className="text-sm text-[var(--muted)]">Round over 🎉</p>
        {isHost ? (
          <button className="btn btn-primary btn-sm" onClick={onNextRound}>
            Next round →
          </button>
        ) : (
          <span className="text-sm text-[var(--faint)]">
            Waiting for the host to start the next round…
          </span>
        )}
      </div>
    );
  }

  if (phase === "challenge") {
    return (
      <div className={shell}>
        <p className="text-sm text-[var(--muted)]">
          Beat the best move count before time runs out — resetting or running
          out of moves costs a penalty.
        </p>
        {giveUpBtn}
      </div>
    );
  }

  if (phase === "open") {
    return (
      <div className={shell}>
        <p className="text-sm text-[var(--muted)]">
          Race to find a solution — the first one starts the countdown.
        </p>
        {giveUpBtn}
      </div>
    );
  }

  return null;
}
