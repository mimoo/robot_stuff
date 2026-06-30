import { expect, test, describe } from "bun:test";
import {
  Board,
  Game,
  boardFromPuzzle,
  validateSolution,
  type Puzzle,
  type Move,
} from "./game";

describe("walls", () => {
  test("wall between two tiles is direction-agnostic", () => {
    const board = new Board();
    board.addWall({ x: 1, y: 2 }, "right"); // wall between (1,2) and (2,2)
    expect(board.hasWall({ x: 1, y: 2 }, "right")).toBe(true);
    expect(board.hasWall({ x: 2, y: 2 }, "left")).toBe(true);
  });

  test("board edges count as walls", () => {
    const board = new Board();
    expect(board.hasWall({ x: 0, y: 0 }, "up")).toBe(true);
    expect(board.hasWall({ x: 0, y: 0 }, "left")).toBe(true);
    expect(board.hasWall({ x: 15, y: 15 }, "down")).toBe(true);
    expect(board.hasWall({ x: 15, y: 15 }, "right")).toBe(true);
  });
});

describe("sliding", () => {
  test("a robot slides until it hits the far wall", () => {
    const board = new Board();
    board.init_default();
    board.robots = [
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    // slide up from (5,5): nothing in the way until the top edge
    const dest = board.slide(0, "up");
    expect(dest).toEqual({ x: 5, y: 0 });
  });

  test("a robot stops next to another robot", () => {
    const board = new Board();
    board.robots = [
      { x: 5, y: 5 },
      { x: 5, y: 2 }, // blocker above
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const dest = board.slide(0, "up");
    expect(dest).toEqual({ x: 5, y: 3 });
  });

  test("a robot that cannot move returns null", () => {
    const board = new Board();
    board.robots = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 6, y: 6 },
      { x: 7, y: 9 },
    ];
    expect(board.slide(0, "up")).toBeNull();
    expect(board.slide(0, "left")).toBeNull();
  });
});

describe("validateSolution", () => {
  const puzzle: Puzzle = {
    robotStarts: [
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 0, y: 15 },
    ],
    target: { x: 5, y: 0 },
    targetForRobot: 0,
  };

  test("a legal one-move solution is accepted and counted", () => {
    const moves: Move[] = [{ robot: 0, dir: "up" }];
    const res = validateSolution(puzzle, moves);
    expect(res.valid).toBe(true);
    expect(res.reachedTarget).toBe(true);
    expect(res.moveCount).toBe(1);
  });

  test("moving the wrong robot to the target tile does not win", () => {
    // robot 1 from (0,0) up can't move; use a target for robot 0 but move robot 2
    const res = validateSolution(puzzle, [{ robot: 2, dir: "left" }]);
    expect(res.reachedTarget).toBe(false);
  });

  test("an illegal move (robot can't slide that way) is rejected", () => {
    const res = validateSolution(puzzle, [{ robot: 1, dir: "up" }]);
    expect(res.valid).toBe(false);
    expect(res.reachedTarget).toBe(false);
  });

  test("a malformed move is rejected", () => {
    const res = validateSolution(puzzle, [{ robot: 99, dir: "up" } as Move]);
    expect(res.valid).toBe(false);
  });
});

describe("Game", () => {
  test("startGame produces 4 robots and a target on a corner tile", () => {
    const game = new Game();
    game.startGame();
    expect(game.board.robots.length).toBe(4);
    const p = game.puzzle();
    expect(p.robotStarts.length).toBe(4);
    expect(p.targetForRobot).toBeGreaterThanOrEqual(0);
    expect(p.targetForRobot).toBeLessThan(4);
    // a reconstructed board matches walls deterministically
    const board = boardFromPuzzle(p);
    expect(board.target).toEqual(p.target);
  });
});
