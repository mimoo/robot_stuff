import type { Move, Puzzle } from "./game";

export type Phase =
  | "lobby" // waiting for players to ready up
  | "starting" // 3-2-1 before a round
  | "open" // round live, no champion yet
  | "challenge" // a champion exists, countdown running
  | "roundEnd" // countdown hit 0, champion won
  | "paused"; // host paused

export type Champion = {
  playerId: string;
  name: string;
  moves: number;
};

export type PublicPlayer = {
  id: string;
  name: string;
  color: string; // avatar color (distinct from robot colors)
  ready: boolean;
  connected: boolean;
  score: number;
  isHost: boolean;
  penalizedUntil: number | null; // epoch ms, or null
  solved: boolean; // has a valid solution this round
  gaveUp: boolean; // conceded this round
};

export type ChatMessage = {
  id: string;
  playerId: string | null; // null = system message
  name: string;
  text: string;
  ts: number;
  system?: boolean;
};

export type Settings = {
  countdownSeconds: number; // challenge countdown, default 60
  penaltySeconds: number; // black-board lockout, default 5
};

// Full snapshot of a room — sent on join and whenever something material changes.
export type RoomState = {
  roomId: string;
  name: string;
  phase: Phase;
  hostId: string;
  settings: Settings;
  players: PublicPlayer[];
  champion: Champion | null;
  // The shared puzzle. Hidden (null) until a round is live so the board stays
  // black during 3-2-1 / lobby.
  puzzle: Puzzle | null;
  round: number;
  // Absolute epoch-ms timestamps for whatever timer is currently running.
  countdownEndsAt: number | null; // challenge countdown
  startCountdownEndsAt: number | null; // 3-2-1
  // Phase the game was in before pausing (so we can resume correctly).
  resumePhase: Phase | null;
};

// ---- Client -> Server ----
export type ClientMessage =
  | { t: "join"; playerId: string; name: string }
  | { t: "setReady"; ready: boolean }
  | { t: "updateSettings"; settings: Partial<Settings> }
  | { t: "startGame" }
  | { t: "nextRound" }
  | { t: "pause" }
  | { t: "resume" }
  | { t: "submitSolution"; moves: Move[] }
  | { t: "reportPenalty"; reason: "reset" | "exhausted" }
  | { t: "giveUp" }
  | { t: "chat"; text: string }
  | { t: "leave" };

// ---- Server -> Client ----
export type ServerMessage =
  | { t: "roomState"; state: RoomState }
  | { t: "chatMessage"; message: ChatMessage }
  | { t: "chatHistory"; messages: ChatMessage[] }
  // sent right after a player's own submission so they get instant feedback
  | { t: "solutionAck"; accepted: boolean; moves: number; champion: boolean }
  | { t: "error"; message: string };

export const DEFAULT_SETTINGS: Settings = {
  countdownSeconds: 60,
  penaltySeconds: 5,
};

export const PLAYER_COLORS = [
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];
