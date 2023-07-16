<script lang="ts" setup>
import { onMounted, computed, ref, Ref, watch } from "vue";
//import { Game } from "#imports";

//
// Refs
//

const game: Ref<Game> = ref(new Game("default name"));
const size: Ref<number> = ref(16);

// start the game on mounted
onMounted(() => {
  game.value.startGame();
});

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
  // unclick
  if (activeRobot.value === robotIdx) {
    activeRobot.value = null;
    activeTiles.value = [];
    return;
  }

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

function resetGame() {
  game.value.board.reset();
  numMoves.value = 0;
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

  // add to move number
  numMoves.value += 1;

  // check winning condition
  if (hasWon) {
    console.log("you won!");
    numMoves.value = 0;
    activeRobot.value = null;
    game.value.startNextRound();
  } else {
    // continue moving?
    activeMovement(activeRobot.value);
  }
}

//
// Timer stuff
//

const DEFAULT_TIMER = 60;

const timeLeft: Ref<number> = ref(DEFAULT_TIMER);
const timerEnabled: Ref<boolean> = ref(false);
let timerId: any = null;

// starts the timer when timerEnabled is set to true
watch(timerEnabled, async (newValue, oldValue) => {
  console.log(`timerEnabled changed from ${oldValue} to ${newValue}`);
  if (newValue) {
    timeLeft.value = DEFAULT_TIMER;
    timerId = setTimeout(() => {
      timeLeft.value--;
    }, 1000);
  }
});

// keeps decreasing the timer when the value of timeLeft changes,
// stops the timer when timeLeft is set to 0
watch(
  timeLeft,
  async (newValue) => {
    console.log("timeLeft changed to " + newValue);
    if (newValue > 0 && timerEnabled.value) {
      timerId = setTimeout(() => {
        timeLeft.value--;
      }, 1000);
    } else if (timerEnabled.value) {
      console.log("timer ended!");
      timerEnabled.value = false;
    }
  },
  { immediate: true } // in case we want to start it at page load
);

function restartTimer() {
  console.log("restarting timer...");
  if (timerId !== null) {
    clearTimeout(timerId);
  }
  timeLeft.value = DEFAULT_TIMER;
    timerEnabled.value = true;
}

function stopTimer() {
    console.log("pausing timer...");
    if (timerId !== null) {
        clearTimeout(timerId);
    }
    timerEnabled.value = false;
}
</script>

<template>
  <div class="container mx-auto">
    <!-- nav -->
    <nav class="mt-5 flex flex-row justify-self-auto gap-7">
      <!-- score -->
      <div>
        <div class="text-base text-gray-400">Moves</div>
        <div class="text-2xl font-bold text-gray-900">{{ numMoves }}</div>
      </div>

      <!-- countdown -->
      <div>
        <span class="countdown font-mono text-6xl">
          <span :style="'--value: ' + timeLeft"></span>
        </span>
      </div>

      <!-- restart timer -->
      <div>
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          @click="restartTimer"
        >
          start timer
        </button>
      </div>

      <!-- pause timer -->
      <div>
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          @click="stopTimer"
        >
          stop timer
        </button>
      </div>

      <!-- reset moves -->
      <div>
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          @click="resetGame"
        >
          reset moves
        </button>
      </div>

      <!-- start a game -->
      <div>
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          @click="startGame"
        >
          start a new game
        </button>
      </div>
    </nav>

    <!-- board -->
    <table
      style="border: 1px black solid"
      class="border-separate table-fixed mx-auto border-black"
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

    <!-- rules -->
    <div class="my-5 hero bg-base-200">
      <div class="hero-content ">
        <div class="max-w-md">
          <h1 class="text-5xl font-bold text-center">Rules</h1>
          <p class="py-2">
            
            <!-- start of list -->
            <div class="flex justify-start cursor-pointer text-gray-700 hover:text-blue-400 hover:bg-blue-100 rounded-md px-2 py-2 my-2">
                <span class="bg-gray-400 h-2 w-2 m-2 rounded-full"></span>
                <div class="flex-grow font-medium px-2">Get a bunch of friends together.</div>
            </div>

            <div class="flex justify-start cursor-pointer text-gray-700 hover:text-blue-400 hover:bg-blue-100 rounded-md px-2 py-2 my-2">
                <span class="bg-gray-400 h-2 w-2 m-2 rounded-full"></span>
                <div class="flex-grow font-medium px-2">If you find a solution (number of moves that gets the robot of the same color as the target, to the target), say it and then restart the timer.</div>
            </div>

            <div class="flex justify-start cursor-pointer text-gray-700 hover:text-blue-400 hover:bg-blue-100 rounded-md px-2 py-2 my-2">
                <span class="bg-gray-400 h-2 w-2 m-2 rounded-full"></span>
                <div class="flex-grow font-medium px-2">The one that finds the shortest solution wins, if nobody finds a smaller number of moves then the original solution wins.</div>
            </div>
            <!-- end of list -->
          </p>
        </div>
      </div>
    </div>
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
