use std::{
    collections::{HashMap, HashSet},
    hash::Hash,
};

const SIZE: usize = 16;
const NUM_ROBOTS: usize = 4;

/// a wall is present between two tiles
type Connection = (Tile, Tile);

#[derive(Debug, Clone, Copy, Eq)]
pub struct Wall(Connection);

impl PartialEq for Wall {
    fn eq(&self, other: &Self) -> bool {
        let mut wall1: [Tile; 2] = self.0.into();
        let mut wall2: [Tile; 2] = other.0.into();
        wall1.sort();
        wall2.sort();
        wall1 == wall2
    }
}

impl Hash for Wall {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        let mut wall: [Tile; 2] = self.0.into();
        wall.sort();
        wall.hash(state);
    }
}

#[derive(Debug, Clone)]
pub struct Player {
    ip: String, // TODO: replace by websocket?
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Tile {
    x: usize,
    y: usize,
}

impl Tile {
    fn new(x: usize, y: usize) -> Self {
        Self { x, y }
    }

    fn new_random() -> Self {
        Self {
            x: rand::random::<usize>() % SIZE,
            y: rand::random::<usize>() % SIZE,
        }
    }

    fn towards(&self, direction: Direction) -> Option<Tile> {
        match direction {
            Direction::Up => {
                let new_y = self.y.checked_sub(1)?;
                Some(Tile::new(self.x, new_y))
            }
            Direction::Down => {
                if self.y >= SIZE - 1 {
                    None
                } else {
                    Some(Tile::new(self.x, self.y + 1))
                }
            }
            Direction::Left => {
                let new_x = self.x.checked_sub(1)?;
                Some(Tile::new(new_x, self.y))
            }
            Direction::Right => {
                if self.x >= SIZE - 1 {
                    None
                } else {
                    Some(Tile::new(self.x + 1, self.y))
                }
            }
        }
    }

    fn wall_on(&self, direction: Direction) -> Wall {
        let other_tile = self.towards(direction).unwrap();
        Wall((self.clone(), other_tile))
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

use Direction::*;

impl Direction {
    fn all() -> [Self; 4] {
        [Up, Down, Left, Right]
    }
}

//
//
//

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
const CORNER_WALLS: [(Tile, (Direction, Direction)); 17] = [
    (Tile { x: 1, y: 2 }, (Up, Left)),
    (Tile { x: 12, y: 8 }, (Up, Left)),
    (Tile { x: 2, y: 9 }, (Up, Left)),
    (Tile { x: 13, y: 14 }, (Up, Left)),
    (Tile { x: 13, y: 1 }, (Up, Left)),
    (Tile { x: 6, y: 5 }, (Up, Right)),
    (Tile { x: 4, y: 13 }, (Up, Right)),
    (Tile { x: 14, y: 12 }, (Up, Right)),
    (Tile { x: 11, y: 6 }, (Up, Right)),
    (Tile { x: 6, y: 1 }, (Down, Right)),
    (Tile { x: 9, y: 2 }, (Down, Right)),
    (Tile { x: 9, y: 11 }, (Down, Right)),
    (Tile { x: 1, y: 14 }, (Down, Right)),
    (Tile { x: 3, y: 6 }, (Down, Left)),
    (Tile { x: 14, y: 5 }, (Down, Left)),
    (Tile { x: 10, y: 9 }, (Down, Left)),
    (Tile { x: 5, y: 8 }, (Down, Left)),
];

const NORMAL_WALLS: [(Tile, Direction); 8] = [
    //top
    (Tile { x: 4, y: 0 }, Right),
    (Tile { x: SIZE - 4, y: 0 }, Left),
    // bottom
    (Tile { x: 6, y: 15 }, Right),
    (Tile { x: SIZE - 5, y: 15 }, Left),
    // left
    (Tile { x: 0, y: 6 }, Down),
    (Tile { x: 0, y: SIZE - 4 }, Up),
    // right
    (Tile { x: 15, y: 4 }, Down),
    (Tile { x: 15, y: SIZE - 5 }, Up),
];

//
//
//

pub struct Board {
    robots: Vec<Tile>,
    robots_backup_positions: Vec<Tile>,
    walls: HashMap<Wall, bool>,
    target: Tile,
    targetForRobot: usize,
}

impl Board {
    fn new() -> Self {
        Self {
            robots: Vec::new(),
            robots_backup_positions: Vec::new(),
            walls: HashMap::new(),
            target: Tile { x: 0, y: 0 },
            targetForRobot: 0,
        }
    }

    fn add_wall(&mut self, wall: Wall) {
        self.walls.insert(wall, true);
    }

    fn init_default(&mut self) {
        // place the walls to form the box in the middle
        self.add_wall(Tile::new(8, 7).wall_on(Right));
        self.add_wall(Tile::new(6, 8).wall_on(Right));
        self.add_wall(Tile::new(8, 8).wall_on(Right));
        self.add_wall(Tile::new(7, 6).wall_on(Down));
        self.add_wall(Tile::new(7, 8).wall_on(Down));
        self.add_wall(Tile::new(8, 6).wall_on(Down));
        self.add_wall(Tile::new(8, 8).wall_on(Down));

        // place 8 normal walls
        for (tile, direction) in NORMAL_WALLS.iter() {
            self.add_wall(tile.wall_on(*direction));
        }

        // place the corner walls
        for (tile, (dir1, dir2)) in CORNER_WALLS.iter() {
            self.add_wall(tile.wall_on(*dir1));
            self.add_wall(tile.wall_on(*dir2));
        }
    }

    fn init_robots(&mut self) {
        self.robots.clear();

        let mut occupied = HashSet::new();
        loop {
            if occupied.len() == NUM_ROBOTS {
                break;
            }

            let tile = Tile::new_random();
            if occupied.contains(&tile) || self.in_middle_box(tile) {
                continue;
            }
            occupied.insert(tile);
            self.robots.push(tile);
        }

        self.robots_backup_positions = self.robots.clone();
    }

    fn clear(&mut self) {
        self.robots.clear();
        self.robots_backup_positions.clear();
    }

    fn reset(&mut self) {
        self.robots = self.robots_backup_positions.clone();
    }

    fn has_wall(&self, curr_tile: Tile, direction: Direction) -> bool {
        let other_tile = if let Some(tile) = curr_tile.towards(direction) {
            tile
        } else {
            return true;
        };
        let key = Wall((curr_tile, other_tile));
        self.walls.get(&key).copied().unwrap_or(false)
    }

    fn has_robot(&self, tile: Tile) -> Option<usize> {
        self.robots.iter().position(|t| t == &tile)
    }

    fn in_middle_box(&self, tile: Tile) -> bool {
        tile.x > 6 && tile.x < 9 && tile.y > 6 && tile.y < 9
    }

    fn can_move_robot(&self, robot: usize) -> Vec<Tile> {
        let curr_tile = self.robots[robot];
        let mut possible_tiles = vec![];

        for direction in Direction::all() {
            let mut final_tile = curr_tile;
            loop {
                let next_tile = if let Some(tile) = final_tile.towards(direction) {
                    tile
                } else {
                    break;
                };
                if self.has_wall(final_tile, direction)
                    || self.has_robot(next_tile).is_some()
                    || self.in_middle_box(next_tile)
                {
                    break;
                }
                final_tile = next_tile;
            }
            if final_tile != curr_tile {
                possible_tiles.push(final_tile);
            }
        }
        possible_tiles
    }

    fn move_robot(&mut self, robot: usize, tile: Tile) -> Result<bool, &'static str> {
        // check if movement is valid
        if !self.can_move_robot(robot).contains(&tile) {
            return Err("invalid move");
        }

        self.robots[robot] = tile;

        Ok(false)
    }
}

pub struct Game {
    board: Board,
    players: Vec<Player>,
}

impl Game {
    pub fn new() -> Self {
        let mut board = Board::new();
        board.init_default();

        Self {
            board,
            players: Vec::new(),
        }
    }

    pub fn add_player(&mut self, player: Player) {
        self.players.push(player);
    }

    pub fn start_game(&mut self) {
        self.board.clear();
        self.board.init_robots();
        self.start_next_round();
    }

    pub fn start_next_round(&mut self) {
        loop {
            /* const pos = Math.floor(Math.random() * corner_walls.length);
            const tile = corner_walls[pos][0];
            if (this.board.hasRobot(tile) === null) {
              this.board.target = tile;
              break;
            } */
            let pos = rand::random::<usize>() % CORNER_WALLS.len();
            let tile = CORNER_WALLS[pos].0;
            if self.board.has_robot(tile).is_none() {
                self.board.target = tile;
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_walls() {
        let wall1 = Wall((Tile::new(1, 2), Tile::new(2, 2)));
        let wall2 = Wall((Tile::new(2, 2), Tile::new(1, 2)));
        assert_eq!(wall1, wall2);
        let mut hashmap = HashMap::new();
        hashmap.insert(wall1, true);
        assert_eq!(hashmap.get(&wall2), Some(&true));
    }
}
