<script lang="ts" setup>
import { computed, ref, Ref } from "vue";
//import { Game } from "#imports";

//
// Refs
//

const game: Ref<Game> = ref(new Game("default name"));
const size: Ref<number> = ref(16);

//
// Methods
//

function startGame() {
  game.value.startGame();
}

interface CellInfo {
  bottom: boolean;
  right: boolean;
  robot: null | number;
  active: boolean;
  isTarget: boolean;
}

const boardInfo = computed(() => {
  // TODO: we can remove that check once board is a props
  if (!game.value) {
    return [];
  }

  let res: CellInfo[][] = [];
  for (let row = 0; row < size.value; row++) {
    res.push([]);
    for (let col = 0; col < size.value; col++) {
      const right = game.value.board.hasWall({ x: col, y: row }, "right");
      const bottom = game.value.board.hasWall({ x: col, y: row }, "down");

      let isTarget = false;
      if (
        game.value.board.target.x == col &&
        game.value.board.target.y == row &&
        !(col == 0 && row == 0) // not initialized
      ) {
        isTarget = true;
      }

      // TODO: compute this based on a hashmap. We have to turn activeTiles into a hashmap first (with a string as key!)
      const active = false;
      res[row][col] = {
        bottom: bottom,
        right: right,
        robot: null,
        active: active,
        isTarget: isTarget,
      };
    }
  }

  // add robots
  game.value.board.robots.forEach((robot: Tile, index: number) => {
    res[robot.y][robot.x].robot = index;
  });

  return res;
});

const robotIdxToColor = ["red", "blue", "green", "purple"];

const activeRobot: Ref<null | number> = ref(null);

// tiles that should appear in color, showing that a robot can be moved there
const activeTiles: Ref<Tile[]> = ref([]);

const numMoves: Ref<number> = ref(0);

// TODO: remove this once we have `active` in the state
function isActive(row_idx: number, col_idx: number) {
  let tile = { x: col_idx, y: row_idx };
  for (const activeTile of activeTiles.value) {
    if (activeTile.x == tile.x && activeTile.y == tile.y) {
      return true;
    }
  }

  return false;
}

function activeMovement(robotIdx: number) {
  console.log(`figuring out movements for robot ${robotIdx}`);

  // reset active tiles
  activeTiles.value = [];

  // set robot
  activeRobot.value = robotIdx;

  // figure out all tiles in one direction
  let tiles: Tile[] = game.value.board.canMoveRobot(robotIdx);
  tiles.forEach((tile) => {
    activeTiles.value.push(tile);
  });
}

function moveTo(row_idx: number, col_idx: number) {
  // sanity check
  if (activeRobot.value === null) {
    throw new Error("active robot is null, can't move null robot, beep boop");
  }

  // move robot
  console.log(`moving robot ${activeRobot.value} to ${row_idx}, ${col_idx}`);
  const hasWon = game.value.board.moveRobot(activeRobot.value, {
    x: col_idx,
    y: row_idx,
  });

  // reset active tiles
  activeTiles.value = [];
  activeRobot.value = null;

  // add to move number
  numMoves.value += 1;

  // check winning condition
  if (hasWon) {
    console.log("you won!");
    numMoves.value = 0;
    game.value.startNextRound();
  }
}
</script>

<template>
  {{ numMoves }}
  <div class="container">
    <table
      style="border: 1px black solid; margin: auto"
      class="border-separate border table-fixed"
    >
      <!-- give class bottom wall only if botom wall is true-->
      <tr v-for="(row, row_idx) in boardInfo">
        <td
          :id="'cell-' + col_idx + '-' + row_idx"
          v-for="(cell, col_idx) in row"
          :class="{
            'top-wall': row_idx == 0,
            'left-wall': col_idx == 0,
            'bottom-wall': cell.bottom,
            'right-wall': cell.right,
            middle:
              (row_idx == 7 || row_idx == 8) && (col_idx == 7 || col_idx == 8),
            'text-center': true,
            'active-tile': isActive(row_idx, col_idx),
          }"
          style="height: 25px; width: 25px; background-color: aliceblue"
          @click="isActive(row_idx, col_idx) ? moveTo(row_idx, col_idx) : null"
        >
          <span v-if="cell.robot !== null">
            <a @click="activeMovement(cell.robot)">
              <Icon
                name="material-symbols:robot-2"
                :color="robotIdxToColor[cell.robot]"
              />
            </a>
          </span>
          <span v-if="cell.isTarget">
            <Icon
              name="material-symbols:target"
              :color="robotIdxToColor[game.board.targetForRobot]"
            />
          </span>
        </td>
      </tr>
    </table>

    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      @click="startGame"
    >
      start a game
    </button>
  </div>
</template>

<style scoped>
.active-tile {
  background-color: yellow !important;
}

.top-wall {
  border-top: 1px black solid;
}

.bottom-wall {
  border-bottom: 1px black solid;
}

.middle {
  background-color: black !important;
}

.right-wall {
  border-right: 1px black solid;
}

.left-wall {
  border-left: 1px black solid;
}
</style>