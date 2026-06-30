# 🤖 Robot Rush

Multiplayer **Ricochet Robots** for you and your friends. Create a room, share the
link, race to find the fewest-move solution, and beat the countdown.

![robot stuff](https://i.imgur.com/pfovAGb.png)

## How it plays

1. Everyone joins a room with a link and picks a name.
2. Players mark **ready**. When everyone's ready it's **3·2·1** and the board randomizes.
3. Slide the matching-colored robot onto the target. **The first solution starts a
   countdown** (default 60s) and everyone sees the move count.
4. During the countdown, anyone can find a **smaller** number of moves to become the new
   champion — the countdown is **not** reset.
5. If you press **reset**, or use up the champion's move count without solving, you're
   **penalized**: a short black-out so you can't keep peeking.
6. Can't find anything? **Give up** 🏳️. If everyone still in contention gives up, the
   round ends immediately (no waiting out the clock).
7. When the countdown hits 0, the champion wins the round. The **host** starts the next
   one with the **▶ Next round** button under the board.

The countdown length and penalty length are configurable in the lobby (host only). Each
player can also pick their own **theme** (dark / light / midnight / sunset) — it's a local
preference, saved per browser.

## Stack

A Bun-workspace monorepo:

```
shared/        # pure game logic (Ricochet Robots) + the WS protocol types, shared by both apps
apps/server/   # Bun.serve WebSocket server — authoritative for rooms, timers, champion, chat (in-memory)
apps/web/      # Next.js (App Router) + Tailwind front-end
```

- The server is the single source of truth. Clients move robots on a **private** copy of
  the shared puzzle and submit the ordered move list; the server **replays and validates**
  it (`validateSolution`), so move counts can't be spoofed.
- Walls are deterministic, so only the puzzle (robot start positions + target) crosses the
  wire. Rooms live in memory and disappear when the server restarts.
- Identity is a name + a `playerId` in `localStorage` — no accounts. Refresh rejoins your seat.

## Run it

Requires [Bun](https://bun.sh) and Node.js (the Next.js dev server runs on the Node
runtime — running it under Bun's runtime triggers a known incompatibility).

```bash
bun install
bun run dev          # starts the WS server (:3001) and the web app (:3000)
```

Then open http://localhost:3000.

Other scripts:

```bash
bun test             # game-logic unit tests (shared/)
bun run dev:server   # just the WebSocket server
bun run dev:web      # just the Next.js app
bun run build:web    # production build of the web app
```

### Configuration

The web client talks to the server via these env vars (defaults shown):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
PORT=3001            # server port
```
