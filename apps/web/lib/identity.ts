"use client";

// Persistent, account-free identity: a stable playerId + a display name kept in
// localStorage so a refresh rejoins the same seat.

const ID_KEY = "robot.playerId";
const NAME_KEY = "robot.name";

// crypto.randomUUID is only available in secure contexts (https / localhost);
// fall back to a good-enough random id elsewhere.
function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return (
    "p-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name.trim());
}

// Per-room "I've picked my name for this room" flag, kept in sessionStorage so a
// refresh doesn't re-prompt, but entering a *new* room (or a new tab) does.
const confirmKey = (roomId: string) => `robot.confirmed.${roomId}`;

export function isRoomConfirmed(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(confirmKey(roomId)) === "1";
}

export function confirmRoom(roomId: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(confirmKey(roomId), "1");
  }
}
