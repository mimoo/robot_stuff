use std::collections::HashMap;

use crate::game::Game;

pub struct Games {
    games: HashMap<String, Game>,
}

impl Games {
    fn new_game(&mut self) -> String {
        // generate random game id
        let game_id = nanoid::nanoid!();
        self.games.insert(game_id.clone(), Game::new());
        game_id
    }

    fn get_game(&self, game_id: &str) -> Option<&Game> {
        self.games.get(game_id)
    }

    fn get_game_mut(&mut self, game_id: &str) -> Option<&mut Game> {
        self.games.get_mut(game_id)
    }

    fn remove_game(&mut self, game_id: &str) -> Option<Game> {
        self.games.remove(game_id)
    }

    fn list_games(&self) -> Vec<&Game> {
        self.games.values().collect()
    }
}
