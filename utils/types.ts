const SIZE = 16;

export type Tile = {
  x: number;
  y: number;
};

const NUM_ROBOTS = 4; // must match number of RobotColor tags

// a wall is present between two tiles
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
const corner_walls: [Tile, string][] = [
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

const normalWalls: [Tile, string][] = [
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

// a board is a 16x16 grid, with 4 robots, 17 right-angled walls that include a target, and 8 normal walls
//
// (0,0) is the top left corner
//
// (0,0) (1,0) (2,0) ... (15,0)
// (0,1) (1,1) (2,1) ... (15,1)
// ...
// (0,15) (1,15) (2,15) ... (15,15)
//
class Board {
  id: string;
  robots: Tile[];
  robotsBackupPositions: Tile[];
  walls: Map<string, boolean>;
  target: Tile;
  targetForRobot: number;

  constructor(name: string) {
    this.id = name;
    this.robots = [];
    this.robotsBackupPositions = [];
    this.walls = new Map();
    this.target = { x: 0, y: 0 };
    this.targetForRobot = 0;
  }

  reset() {
    console.log("resetting board");
    console.log(this.robotsBackupPositions);
    console.log(this.robots);
    this.robots = [...this.robotsBackupPositions];
  }

  otherTileFrom(tile: Tile, direction: string): Tile {
    let res = { ...tile };

    if (direction == "up") {
      if (tile.y <= 0) {
        throw new Error("can't go further up");
      }
      res.y -= 1;
    } else if (direction == "down") {
      if (tile.y >= SIZE - 1) {
        throw new Error("can't go further down");
      }
      res.y += 1;
    } else if (direction == "left") {
      if (tile.x <= 0) {
        throw new Error("can't go further left");
      }
      res.x -= 1;
    } else if (direction == "right") {
      if (tile.x >= SIZE - 1) {
        throw new Error("can't go further right");
      }
      res.x += 1;
    } else {
      throw new Error("invalid direction");
    }

    return res;
  }

  moveRobot(robot: number, tile: Tile): boolean {
    this.robots[robot] = tile;

    // check for win
    if (
      tile.x == this.target.x &&
      tile.y == this.target.y &&
      robot == this.targetForRobot
    ) {
      return true;
    }

    return false;
  }

  canMoveRobot(robot: number): Tile[] {
    // get position
    let curr_tile = this.robots[robot];

    // init
    const possibleDirections = ["up", "down", "left", "right"];
    let possibleTiles = [];

    // go through every direction
    for (let direction of possibleDirections) {
      console.log(`figure out movement for ${direction} direction`);
      let finalTile = curr_tile;
      while (true) {
        try {
          // compute next tile
          let next_tile = this.otherTileFrom(finalTile, direction);

          // check if there's a wall, or a robot in the way
          if (
            this.hasWall(finalTile, direction) ||
            this.hasRobot(next_tile) !== null
          ) {
            break;
          }

          // otherwise we can go to that tile
          finalTile = next_tile;
          console.log(`can go to (${finalTile.x}, ${finalTile.y})`);
        } catch (e) {
          // we reached a wall
          break;
        }
      }

      // if we have moved, let's include that as a possible tile
      if (finalTile != curr_tile) {
        console.log(
          `final movement in that direction is (${finalTile.x}, ${finalTile.y})`
        );
        possibleTiles.push(finalTile);
      } else {
        console.log(`couldn't move in that direction`);
      }
    }

    //
    return possibleTiles;
  }

  hasRobot(tile: Tile): null | number {
    for (let idx = 0; idx < this.robots.length; idx++) {
      if (this.robots[idx].x == tile.x && this.robots[idx].y == tile.y) {
        return idx;
      }
    }
    return null;
  }

  wallKey(connection: Connection): string {
    connection.sort((a, b) => {
      if (a.x < b.x) {
        return -1;
      } else if (a.x > b.x) {
        return 1;
      } else {
        if (a.y < b.y) {
          return -1;
        } else if (a.y > b.y) {
          return 1;
        } else {
          return 0;
        }
      }
    });
    return `(${connection[0].x},${connection[0].y})-(${connection[1].x},${connection[1].y})`;
  }

  hasWall(curr_tile: Tile, direction: string): boolean {
    try {
      let other_tile = this.otherTileFrom(curr_tile, direction);
      let key = this.wallKey([curr_tile, other_tile]);
      return this.walls.get(key) || false;
    } catch (e) {
      return true;
    }
  }

  addWall(curr_tile: Tile, direction: string) {
    let other_tile = this.otherTileFrom(curr_tile, direction);
    let key = this.wallKey([curr_tile, other_tile]);
    this.walls.set(key, true);
  }

  addCornerWall(curr_tile: Tile, corner: string) {
    if (corner == "top-left") {
      this.addWall(curr_tile, "up");
      this.addWall(curr_tile, "left");
    } else if (corner == "top-right") {
      this.addWall(curr_tile, "up");
      this.addWall(curr_tile, "right");
    } else if (corner == "bottom-left") {
      this.addWall(curr_tile, "down");
      this.addWall(curr_tile, "left");
    } else if (corner == "bottom-right") {
      this.addWall(curr_tile, "down");
      this.addWall(curr_tile, "right");
    } else {
      throw new Error("invalid corner");
    }
  }

  clear() {
    this.robots = [];
  }

  init_default() {
    // place the walls to form the box in the middle
    this.addWall({ x: 8, y: 7 }, "right");
    this.addWall({ x: 6, y: 8 }, "right");
    this.addWall({ x: 8, y: 8 }, "right");
    this.addWall({ x: 7, y: 6 }, "down");
    this.addWall({ x: 7, y: 8 }, "down");
    this.addWall({ x: 8, y: 6 }, "down");
    this.addWall({ x: 8, y: 8 }, "down");

    // place 8 normal walls
    for (const [tile, direction] of normalWalls) {
      this.addWall(tile, direction);
    }

    // place the corner walls
    for (let [tile, direction] of corner_walls) {
      this.addCornerWall(tile, direction);
    }
  }

  initRobots() {
    let occupied = new Set();
    while (true) {
      if (occupied.size == NUM_ROBOTS) {
        break;
      }
      let pos = Math.floor(Math.random() * corner_walls.length);
      if (occupied.has(pos)) {
        continue;
      }
      occupied.add(pos);
      this.robots.push(corner_walls[pos][0]);
    }

    // backup
    this.robotsBackupPositions = [...this.robots];
  }
}

export class Game {
  board: Board;

  constructor(name: string) {
    // initialize a new board with the default
    this.board = new Board(name);
    this.board.init_default();
  }

  // init the board and place the robots
  startGame() {
    this.board.clear();
    this.board.initRobots();
    this.startNextRound();
  }

  // find a new target tile
  startNextRound() {
    // set a random target tile
    while (true) {
      const pos = Math.floor(Math.random() * corner_walls.length);
      const tile = corner_walls[pos][0];
      if (this.board.hasRobot(tile) === null) {
        this.board.target = tile;
        break;
      }
    }

    // target a random robot
    const robot = Math.floor(Math.random() * NUM_ROBOTS);
    this.board.targetForRobot = robot;

    // backup
    this.board.robotsBackupPositions = [...this.board.robots];
  }
}
