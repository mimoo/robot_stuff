// Ricochet Robots core game logic — pure, no DOM, shared by server (authoritative)
// and client (private attempt board + move preview).

export const SIZE = 16;
export const NUM_ROBOTS = 4; // must match ROBOT_COLORS length

export type Tile = { x: number; y: number };

export type Direction = "up" | "down" | "left" | "right";
export const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

export const ROBOT_COLORS = ["red", "blue", "green", "purple"] as const;
export type RobotColor = (typeof ROBOT_COLORS)[number];

// A move slides a given robot in a direction until it stops.
export type Move = { robot: number; dir: Direction };

// The minimal puzzle state that travels over the wire. Walls are deterministic
// (init_default) so they are reconstructed on both ends and never serialized.
export type Puzzle = {
  robotStarts: Tile[];
  target: Tile;
  targetForRobot: number;
};

// a wall sits between two adjacent tiles
type Connection = [Tile, Tile];

//   0 1 2 3 4 5 6 7 8 9 A B C D E F
// 0 . . . . .|. . . . . . .|. _ . .
// 1 . _ . . . . _|. . . . . .|. . .
// 2 .|. . . . . . . . _|. . . . . .
// 3 . . . . . . . . . . . . . . . _
// 4 . . . . . . _ . . . . . . . . .
// 5 _ . . . . . .|. . . . _ . .|_ .
// 6 . . .|_ . . . . . . . .|. . . .
// 7 . . . . . . . x x . . . _ . . .
// 8 . . _ . .|_ . x x . . .|. . . .
// 9 . .|. . . . . . . .|_ . . . . .
// A . . . . . . . . . . . . . . . _
// B _ . . . . . . . . _|. . . . _ .
// C . . . . _ . . . . . . . . . .|.
// D . . . . .|. . . . . . . . _ . .
// E . _|. . . . . . . . . . .|. . .
// F . . . . . .|. . . . .|. . . . .
const CORNER_WALLS: [Tile, string][] = [
  [{ x: 1, y: 2 }, "top-left"],
  [{ x: 12, y: 8 }, "top-left"],
  [{ x: 2, y: 9 }, "top-left"],
  [{ x: 13, y: 14 }, "top-left"],
  [{ x: 13, y: 1 }, "top-left"],
  [{ x: 6, y: 5 }, "top-right"],
  [{ x: 4, y: 13 }, "top-right"],
  [{ x: 14, y: 12 }, "top-right"],
  [{ x: 11, y: 6 }, "top-right"],
  [{ x: 6, y: 1 }, "bottom-right"],
  [{ x: 9, y: 2 }, "bottom-right"],
  [{ x: 9, y: 11 }, "bottom-right"],
  [{ x: 1, y: 14 }, "bottom-right"],
  [{ x: 3, y: 6 }, "bottom-left"],
  [{ x: 14, y: 5 }, "bottom-left"],
  [{ x: 10, y: 9 }, "bottom-left"],
  [{ x: 5, y: 8 }, "bottom-left"],
];

const NORMAL_WALLS: [Tile, Direction][] = [
  // top
  [{ x: 4, y: 0 }, "right"],
  [{ x: SIZE - 4, y: 0 }, "left"],
  // bottom
  [{ x: 6, y: 15 }, "right"],
  [{ x: SIZE - 5, y: 15 }, "left"],
  // left
  [{ x: 0, y: 6 }, "down"],
  [{ x: 0, y: SIZE - 4 }, "up"],
  // right
  [{ x: 15, y: 4 }, "down"],
  [{ x: 15, y: SIZE - 5 }, "up"],
];

export function randInt(max: number): number {
  return Math.floor(Math.random() * max);
}

export class Board {
  robots: Tile[] = [];
  robotsBackupPositions: Tile[] = [];
  walls: Map<string, boolean> = new Map();
  target: Tile = { x: 0, y: 0 };
  targetForRobot = 0;

  reset() {
    this.robots = this.robotsBackupPositions.map((t) => ({ ...t }));
  }

  otherTileFrom(tile: Tile, direction: Direction): Tile {
    const res = { ...tile };
    if (direction === "up") {
      if (tile.y <= 0) throw new Error("edge");
      res.y -= 1;
    } else if (direction === "down") {
      if (tile.y >= SIZE - 1) throw new Error("edge");
      res.y += 1;
    } else if (direction === "left") {
      if (tile.x <= 0) throw new Error("edge");
      res.x -= 1;
    } else if (direction === "right") {
      if (tile.x >= SIZE - 1) throw new Error("edge");
      res.x += 1;
    }
    return res;
  }

  // Returns the tile a robot lands on if it slides in `direction`, or null if it
  // cannot move at all in that direction.
  slide(robot: number, direction: Direction): Tile | null {
    const curr = this.robots[robot];
    let finalTile = curr;
    while (true) {
      let next: Tile;
      try {
        next = this.otherTileFrom(finalTile, direction);
      } catch {
        break;
      }
      if (
        this.hasWall(finalTile, direction) ||
        this.hasRobot(next) !== null ||
        this.inMiddleBox(next)
      ) {
        break;
      }
      finalTile = next;
    }
    if (finalTile.x === curr.x && finalTile.y === curr.y) return null;
    return finalTile;
  }

  // All tiles the robot could slide to (one per direction it can move).
  canMoveRobot(robot: number): Tile[] {
    const tiles: Tile[] = [];
    for (const direction of DIRECTIONS) {
      const dest = this.slide(robot, direction);
      if (dest) tiles.push(dest);
    }
    return tiles;
  }

  // Moves a robot to a destination tile. Returns true if the win condition is met.
  moveRobot(robot: number, tile: Tile): boolean {
    this.robots[robot] = tile;
    return (
      tile.x === this.target.x &&
      tile.y === this.target.y &&
      robot === this.targetForRobot
    );
  }

  hasRobot(tile: Tile): number | null {
    for (let idx = 0; idx < this.robots.length; idx++) {
      if (this.robots[idx].x === tile.x && this.robots[idx].y === tile.y) {
        return idx;
      }
    }
    return null;
  }

  private wallKey(connection: Connection): string {
    connection.sort((a, b) => (a.x - b.x !== 0 ? a.x - b.x : a.y - b.y));
    return `(${connection[0].x},${connection[0].y})-(${connection[1].x},${connection[1].y})`;
  }

  hasWall(curr: Tile, direction: Direction): boolean {
    try {
      const other = this.otherTileFrom(curr, direction);
      return this.walls.get(this.wallKey([curr, other])) || false;
    } catch {
      return true; // board edge counts as a wall
    }
  }

  addWall(curr: Tile, direction: Direction) {
    const other = this.otherTileFrom(curr, direction);
    this.walls.set(this.wallKey([curr, other]), true);
  }

  addCornerWall(curr: Tile, corner: string) {
    if (corner === "top-left") {
      this.addWall(curr, "up");
      this.addWall(curr, "left");
    } else if (corner === "top-right") {
      this.addWall(curr, "up");
      this.addWall(curr, "right");
    } else if (corner === "bottom-left") {
      this.addWall(curr, "down");
      this.addWall(curr, "left");
    } else if (corner === "bottom-right") {
      this.addWall(curr, "down");
      this.addWall(curr, "right");
    } else {
      throw new Error("invalid corner");
    }
  }

  init_default() {
    // box in the middle
    this.addWall({ x: 8, y: 7 }, "right");
    this.addWall({ x: 6, y: 8 }, "right");
    this.addWall({ x: 8, y: 8 }, "right");
    this.addWall({ x: 7, y: 6 }, "down");
    this.addWall({ x: 7, y: 8 }, "down");
    this.addWall({ x: 8, y: 6 }, "down");
    this.addWall({ x: 8, y: 8 }, "down");

    for (const [tile, direction] of NORMAL_WALLS) {
      this.addWall(tile, direction);
    }
    for (const [tile, corner] of CORNER_WALLS) {
      this.addCornerWall(tile, corner);
    }
  }

  inMiddleBox(tile: Tile): boolean {
    return (
      (tile.x === 7 && (tile.y === 7 || tile.y === 8)) ||
      (tile.x === 8 && (tile.y === 7 || tile.y === 8))
    );
  }

  initRobots() {
    this.robots = [];
    const occupied = new Set<string>();
    while (occupied.size < NUM_ROBOTS) {
      const x = randInt(SIZE);
      const y = randInt(SIZE);
      const key = `${x},${y}`;
      const tile = { x, y };
      if (occupied.has(key) || this.inMiddleBox(tile)) continue;
      occupied.add(key);
      this.robots.push(tile);
    }
    this.robotsBackupPositions = this.robots.map((t) => ({ ...t }));
  }

  // Load a fixed puzzle (used by the client and validator).
  loadPuzzle(puzzle: Puzzle) {
    this.robots = puzzle.robotStarts.map((t) => ({ ...t }));
    this.robotsBackupPositions = puzzle.robotStarts.map((t) => ({ ...t }));
    this.target = { ...puzzle.target };
    this.targetForRobot = puzzle.targetForRobot;
  }
}

export class Game {
  board: Board;

  constructor() {
    this.board = new Board();
    this.board.init_default();
  }

  // Place robots and pick the first target.
  startGame() {
    this.board.initRobots();
    this.startNextRound();
  }

  // Pick a fresh random target (a corner-wall tile not under a robot) and a
  // random robot to be sent there, then snapshot robot positions as the puzzle.
  startNextRound() {
    while (true) {
      const tile = CORNER_WALLS[randInt(CORNER_WALLS.length)][0];
      if (this.board.hasRobot(tile) === null) {
        this.board.target = { ...tile };
        break;
      }
    }
    this.board.targetForRobot = randInt(NUM_ROBOTS);
    this.board.robotsBackupPositions = this.board.robots.map((t) => ({ ...t }));
  }

  puzzle(): Puzzle {
    return {
      robotStarts: this.board.robots.map((t) => ({ ...t })),
      target: { ...this.board.target },
      targetForRobot: this.board.targetForRobot,
    };
  }
}

// Build a board with the default walls and a loaded puzzle. Handy for clients.
export function boardFromPuzzle(puzzle: Puzzle): Board {
  const board = new Board();
  board.init_default();
  board.loadPuzzle(puzzle);
  return board;
}

export type SolutionResult = {
  valid: boolean; // every move was a legal slide
  reachedTarget: boolean; // ended on the target with the right robot
  moveCount: number; // number of slides that actually happened
};

// Authoritatively replay an ordered list of moves from the puzzle start and
// report whether it legally reaches the target, and in how many moves. Used by
// the server so clients can never spoof a move count.
export function validateSolution(puzzle: Puzzle, moves: Move[]): SolutionResult {
  const board = boardFromPuzzle(puzzle);
  let moveCount = 0;
  for (const move of moves) {
    if (
      move == null ||
      move.robot < 0 ||
      move.robot >= board.robots.length ||
      !DIRECTIONS.includes(move.dir)
    ) {
      return { valid: false, reachedTarget: false, moveCount };
    }
    const dest = board.slide(move.robot, move.dir);
    if (!dest) {
      // robot can't move that way — illegal move
      return { valid: false, reachedTarget: false, moveCount };
    }
    moveCount++;
    const won = board.moveRobot(move.robot, dest);
    if (won) {
      return { valid: true, reachedTarget: true, moveCount };
    }
  }
  return { valid: true, reachedTarget: false, moveCount };
}
