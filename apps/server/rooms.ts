import { Game, validateSolution, type Move } from "@robot/shared/game";
import {
  DEFAULT_SETTINGS,
  PLAYER_COLORS,
  type ChatMessage,
  type Champion,
  type ClientMessage,
  type Phase,
  type PublicPlayer,
  type RoomState,
  type ServerMessage,
  type Settings,
} from "@robot/shared/protocol";
import type { Server, ServerWebSocket } from "bun";

const START_COUNTDOWN_MS = 3000; // 3-2-1
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000; // delete a room 10min after the last player leaves
const MAX_CHAT = 200;

export type SocketData = {
  roomId: string;
  playerId: string;
  name: string;
};
type WS = ServerWebSocket<SocketData>;

type ServerPlayer = {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  connected: boolean;
  score: number;
  penalizedUntil: number | null;
  solved: boolean;
  gaveUp: boolean;
  ws: WS | null;
};

type Room = {
  id: string;
  name: string;
  hostId: string;
  players: Map<string, ServerPlayer>;
  joinOrder: string[];
  chat: ChatMessage[];
  settings: Settings;
  game: Game | null;
  champion: Champion | null;
  phase: Phase;
  round: number;
  countdownEndsAt: number | null;
  startCountdownEndsAt: number | null;
  resumePhase: Phase | null;
  pausedRemainingMs: number | null;
  startTimer: ReturnType<typeof setTimeout> | null;
  challengeTimer: ReturnType<typeof setTimeout> | null;
  deleteTimer: ReturnType<typeof setTimeout> | null;
};

function shortId(len = 6): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function msgId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  server: Server | null = null;

  createRoom(name: string): string {
    let id = shortId();
    while (this.rooms.has(id)) id = shortId();
    this.rooms.set(id, {
      id,
      name: name?.trim() || "Robot Room",
      hostId: "",
      players: new Map(),
      joinOrder: [],
      chat: [],
      settings: { ...DEFAULT_SETTINGS },
      game: null,
      champion: null,
      phase: "lobby",
      round: 0,
      countdownEndsAt: null,
      startCountdownEndsAt: null,
      resumePhase: null,
      pausedRemainingMs: null,
      startTimer: null,
      challengeTimer: null,
      deleteTimer: null,
    });
    return id;
  }

  hasRoom(id: string): boolean {
    return this.rooms.has(id);
  }

  // ---- socket lifecycle ----

  onOpen(ws: WS) {
    const { roomId, playerId, name } = ws.data;
    const room = this.rooms.get(roomId);
    if (!room) {
      this.send(ws, { t: "error", message: "Room not found." });
      ws.close(4004, "room not found");
      return;
    }
    if (room.deleteTimer) {
      clearTimeout(room.deleteTimer);
      room.deleteTimer = null;
    }
    ws.subscribe(roomId);

    let player = room.players.get(playerId);
    if (player) {
      // reconnect: reclaim the seat
      player.connected = true;
      player.name = name || player.name;
      player.ws = ws;
    } else {
      const color = PLAYER_COLORS[room.joinOrder.length % PLAYER_COLORS.length];
      player = {
        id: playerId,
        name: name?.trim() || "Player",
        color,
        ready: false,
        connected: true,
        score: 0,
        penalizedUntil: null,
        solved: false,
        gaveUp: false,
        ws,
      };
      room.players.set(playerId, player);
      room.joinOrder.push(playerId);
      this.systemChat(room, `${player.name} joined`);
    }

    if (!room.hostId || !this.hasConnectedHost(room)) {
      room.hostId = playerId;
    }

    // send this player the full snapshot + chat history, then update everyone
    this.send(ws, { t: "roomState", state: this.snapshot(room) });
    this.send(ws, { t: "chatHistory", messages: room.chat });
    this.broadcastState(room);
  }

  onClose(ws: WS) {
    const room = this.rooms.get(ws.data.roomId);
    if (!room) return;
    const player = room.players.get(ws.data.playerId);
    if (!player || player.ws !== ws) return;
    player.connected = false;
    player.ws = null;

    if (!this.hasConnectedHost(room)) {
      const next = room.joinOrder.find((id) => room.players.get(id)?.connected);
      if (next) room.hostId = next;
    }

    if (![...room.players.values()].some((p) => p.connected)) {
      room.deleteTimer = setTimeout(() => {
        this.clearTimers(room);
        this.rooms.delete(room.id);
      }, EMPTY_ROOM_TTL_MS);
    }
    this.broadcastState(room);
  }

  onMessage(ws: WS, raw: string) {
    const room = this.rooms.get(ws.data.roomId);
    if (!room) return;
    const player = room.players.get(ws.data.playerId);
    if (!player) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.t) {
      case "setReady":
        player.ready = msg.ready;
        this.broadcastState(room);
        this.maybeAutoStart(room);
        break;

      case "updateSettings":
        if (!this.isHost(room, player) || room.phase !== "lobby") break;
        if (typeof msg.settings.countdownSeconds === "number") {
          room.settings.countdownSeconds = clamp(msg.settings.countdownSeconds, 10, 600);
        }
        if (typeof msg.settings.penaltySeconds === "number") {
          room.settings.penaltySeconds = clamp(msg.settings.penaltySeconds, 1, 30);
        }
        this.broadcastState(room);
        break;

      case "startGame":
        if (!this.isHost(room, player)) break;
        if (room.phase === "lobby" || room.phase === "roundEnd") {
          this.beginStartCountdown(room);
        }
        break;

      case "nextRound":
        if (!this.isHost(room, player)) break;
        if (room.phase === "roundEnd") this.beginStartCountdown(room);
        break;

      case "pause":
        if (this.isHost(room, player)) this.pause(room);
        break;

      case "resume":
        if (this.isHost(room, player)) this.resume(room);
        break;

      case "submitSolution":
        this.handleSolution(room, player, msg.moves);
        break;

      case "reportPenalty":
        if (room.phase === "challenge") {
          player.penalizedUntil = Date.now() + room.settings.penaltySeconds * 1000;
          this.broadcastState(room);
        }
        break;

      case "giveUp":
        if (
          (room.phase === "open" || room.phase === "challenge") &&
          room.champion?.playerId !== player.id &&
          !player.gaveUp
        ) {
          player.gaveUp = true;
          this.systemChat(room, `${player.name} gave up 🏳️`);
          this.broadcastState(room);
          this.maybeEndEarly(room);
        }
        break;

      case "chat": {
        const text = (msg.text || "").toString().slice(0, 500).trim();
        if (!text) break;
        this.pushChat(room, {
          id: msgId(),
          playerId: player.id,
          name: player.name,
          text,
          ts: Date.now(),
        });
        break;
      }

      case "leave":
        this.removePlayer(room, player.id);
        break;
    }
  }

  // ---- game flow ----

  private maybeAutoStart(room: Room) {
    if (room.phase !== "lobby") return;
    const connected = [...room.players.values()].filter((p) => p.connected);
    if (connected.length >= 1 && connected.every((p) => p.ready)) {
      this.beginStartCountdown(room);
    }
  }

  private beginStartCountdown(room: Room) {
    this.clearTimers(room);
    room.phase = "starting";
    room.champion = null;
    room.countdownEndsAt = null;
    room.startCountdownEndsAt = Date.now() + START_COUNTDOWN_MS;
    for (const p of room.players.values()) {
      p.solved = false;
      p.penalizedUntil = null;
      p.gaveUp = false;
    }
    this.broadcastState(room);
    room.startTimer = setTimeout(() => this.beginOpenRound(room), START_COUNTDOWN_MS);
  }

  private beginOpenRound(room: Room) {
    this.clearTimers(room);
    const game = new Game();
    game.startGame();
    room.game = game;
    room.phase = "open";
    room.round += 1;
    room.champion = null;
    room.startCountdownEndsAt = null;
    room.countdownEndsAt = null;
    for (const p of room.players.values()) {
      p.solved = false;
      p.penalizedUntil = null;
      p.gaveUp = false;
      p.ready = false;
    }
    this.broadcastState(room);
  }

  // End the round early if everyone still in contention has given up.
  private maybeEndEarly(room: Room) {
    const contenders = [...room.players.values()].filter(
      (p) => p.connected && p.id !== room.champion?.playerId,
    );
    if (contenders.length === 0 || !contenders.every((p) => p.gaveUp)) return;

    if (room.phase === "challenge" && room.champion) {
      this.endChallenge(room); // champion wins now instead of waiting out the clock
    } else if (room.phase === "open") {
      this.clearTimers(room);
      room.phase = "roundEnd";
      this.systemChat(room, `Everyone gave up — nobody wins round ${room.round}.`);
      this.broadcastState(room);
    }
  }

  private handleSolution(room: Room, player: ServerPlayer, moves: Move[]) {
    if ((room.phase !== "open" && room.phase !== "challenge") || !room.game) {
      this.send(player.ws, { t: "solutionAck", accepted: false, moves: 0, champion: false });
      return;
    }
    if (!Array.isArray(moves) || moves.length === 0) {
      this.send(player.ws, { t: "solutionAck", accepted: false, moves: 0, champion: false });
      return;
    }
    const res = validateSolution(room.game.puzzle(), moves);
    if (!res.valid || !res.reachedTarget) {
      this.send(player.ws, { t: "solutionAck", accepted: false, moves: res.moveCount, champion: false });
      return;
    }

    player.solved = true;
    let becameChampion = false;

    if (room.phase === "open") {
      // first solution of the round: become champion, start the challenge clock
      room.champion = { playerId: player.id, name: player.name, moves: res.moveCount };
      room.phase = "challenge";
      room.countdownEndsAt = Date.now() + room.settings.countdownSeconds * 1000;
      room.challengeTimer = setTimeout(
        () => this.endChallenge(room),
        room.settings.countdownSeconds * 1000,
      );
      becameChampion = true;
      this.systemChat(room, `${player.name} set the bar at ${res.moveCount} moves — countdown started!`);
    } else if (room.champion && res.moveCount < room.champion.moves) {
      // beat the champion (countdown is NOT reset)
      room.champion = { playerId: player.id, name: player.name, moves: res.moveCount };
      becameChampion = true;
      this.systemChat(room, `${player.name} found a better solution: ${res.moveCount} moves!`);
    }

    this.send(player.ws, {
      t: "solutionAck",
      accepted: true,
      moves: res.moveCount,
      champion: becameChampion,
    });
    this.broadcastState(room);
  }

  private endChallenge(room: Room) {
    this.clearTimers(room);
    room.phase = "roundEnd";
    room.countdownEndsAt = null;
    if (room.champion) {
      const winner = room.players.get(room.champion.playerId);
      if (winner) winner.score += 1;
      this.systemChat(
        room,
        `${room.champion.name} wins round ${room.round} with ${room.champion.moves} moves! 🏆`,
      );
    }
    this.broadcastState(room);
  }

  private pause(room: Room) {
    if (room.phase === "paused") return;
    if (room.phase !== "open" && room.phase !== "challenge" && room.phase !== "starting") return;
    room.resumePhase = room.phase;

    if (room.phase === "challenge" && room.countdownEndsAt) {
      room.pausedRemainingMs = Math.max(0, room.countdownEndsAt - Date.now());
    } else if (room.phase === "starting" && room.startCountdownEndsAt) {
      room.pausedRemainingMs = Math.max(0, room.startCountdownEndsAt - Date.now());
    } else {
      room.pausedRemainingMs = null;
    }
    this.clearTimers(room);
    room.countdownEndsAt = null;
    room.startCountdownEndsAt = null;
    room.phase = "paused";
    this.broadcastState(room);
  }

  private resume(room: Room) {
    if (room.phase !== "paused" || !room.resumePhase) return;
    const back = room.resumePhase;
    room.resumePhase = null;
    const remaining = room.pausedRemainingMs;
    room.pausedRemainingMs = null;
    room.phase = back;

    if (back === "challenge") {
      const ms = remaining ?? room.settings.countdownSeconds * 1000;
      room.countdownEndsAt = Date.now() + ms;
      room.challengeTimer = setTimeout(() => this.endChallenge(room), ms);
    } else if (back === "starting") {
      const ms = remaining ?? START_COUNTDOWN_MS;
      room.startCountdownEndsAt = Date.now() + ms;
      room.startTimer = setTimeout(() => this.beginOpenRound(room), ms);
    }
    this.broadcastState(room);
  }

  private removePlayer(room: Room, playerId: string) {
    const player = room.players.get(playerId);
    if (!player) return;
    room.players.delete(playerId);
    room.joinOrder = room.joinOrder.filter((id) => id !== playerId);
    this.systemChat(room, `${player.name} left`);
    if (room.hostId === playerId) {
      const next = room.joinOrder.find((id) => room.players.get(id)?.connected);
      room.hostId = next ?? room.joinOrder[0] ?? "";
    }
    if (room.players.size === 0) {
      this.clearTimers(room);
      this.rooms.delete(room.id);
      return;
    }
    this.broadcastState(room);
  }

  // ---- helpers ----

  private isHost(room: Room, player: ServerPlayer): boolean {
    return room.hostId === player.id;
  }

  private hasConnectedHost(room: Room): boolean {
    const host = room.players.get(room.hostId);
    return !!host && host.connected;
  }

  private clearTimers(room: Room) {
    if (room.startTimer) clearTimeout(room.startTimer);
    if (room.challengeTimer) clearTimeout(room.challengeTimer);
    room.startTimer = null;
    room.challengeTimer = null;
  }

  private systemChat(room: Room, text: string) {
    this.pushChat(room, {
      id: msgId(),
      playerId: null,
      name: "system",
      text,
      ts: Date.now(),
      system: true,
    });
  }

  private pushChat(room: Room, message: ChatMessage) {
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT) room.chat.shift();
    this.publish(room, { t: "chatMessage", message });
  }

  private snapshot(room: Room): RoomState {
    const players: PublicPlayer[] = room.joinOrder
      .filter((id) => room.players.has(id))
      .map((id) => {
        const p = room.players.get(id)!;
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          ready: p.ready,
          connected: p.connected,
          score: p.score,
          isHost: room.hostId === p.id,
          penalizedUntil: p.penalizedUntil,
          solved: p.solved,
          gaveUp: p.gaveUp,
        };
      });

    const showPuzzle =
      room.game &&
      (room.phase === "open" || room.phase === "challenge" || room.phase === "roundEnd");

    return {
      roomId: room.id,
      name: room.name,
      phase: room.phase,
      hostId: room.hostId,
      settings: room.settings,
      players,
      champion: room.champion,
      puzzle: showPuzzle ? room.game!.puzzle() : null,
      round: room.round,
      countdownEndsAt: room.countdownEndsAt,
      startCountdownEndsAt: room.startCountdownEndsAt,
      resumePhase: room.resumePhase,
    };
  }

  private broadcastState(room: Room) {
    this.publish(room, { t: "roomState", state: this.snapshot(room) });
  }

  private publish(room: Room, msg: ServerMessage) {
    this.server?.publish(room.id, JSON.stringify(msg));
  }

  private send(ws: WS | null, msg: ServerMessage) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
