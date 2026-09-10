import type { GameState } from '../core/types';
import { createRng, randomSeed } from '../core/rng';
import { addLog } from '../core/log';
import { generateDungeon, updateVisibility } from './dungeon';
import { spawnEnemies } from './enemy';
import { spawnEntities, healPlayer } from './loot';
import { createPlayer } from './player';
import { DESCEND_HEAL } from '../core/constants';

/**
 * 新しい Run を開始する。
 * seed を渡せば同じダンジョンが再現される（バグ調査用）。
 */
export function createGame(seed: number = randomSeed()): GameState {
  const rng = createRng(seed);
  const floor = 1;
  // フロア生成は seed と floor から決まる子 RNG を使う。
  // ターン中の乱数消費に生成結果が影響されないようにするため。
  const floorRng = rng.fork(floor);
  const dungeon = generateDungeon(floorRng, floor);
  const player = createPlayer(dungeon.start);
  const enemies = spawnEnemies(floorRng, dungeon, floor);

  updateVisibility(dungeon, player.pos);

  const state: GameState = {
    phase: 'playing',
    rng,
    seed,
    floor,
    dungeon,
    player,
    enemies,
    entities: spawnEntities(floorRng, dungeon, floor, enemies.map((e) => e.pos)),
    pendingChoices: [],
    log: [],
    stats: {
      startedAt: Date.now(),
      kills: 0,
      bossKills: 0,
      goldEarned: 0,
      deepestFloor: floor,
      chestsOpened: 0,
    },
  };

  addLog(state.log, 'log.welcome', {}, 'system');
  addLog(state.log, 'log.floor', { floor }, 'system');
  return state;
}

/** 階段を降りて次のフロアへ。HP や成長は引き継ぐ。 */
export function descend(state: GameState): void {
  state.floor += 1;
  state.stats.deepestFloor = Math.max(state.stats.deepestFloor, state.floor);

  const floorRng = state.rng.fork(state.floor);
  const dungeon = generateDungeon(floorRng, state.floor);

  state.dungeon = dungeon;
  state.player.pos = { ...dungeon.start };
  state.enemies = spawnEnemies(floorRng, dungeon, state.floor);
  state.entities = spawnEntities(floorRng, dungeon, state.floor, state.enemies.map((e) => e.pos));

  updateVisibility(dungeon, state.player.pos);
  addLog(state.log, 'log.floor', { floor: state.floor }, 'system');

  // 降りると少し回復する。「フロアを掃除して稼ぐか、傷が浅いうちに降りるか」の
  // 判断を作るための回復源（docs/07 §7.4 レバー4）。
  const healed = healPlayer(state, DESCEND_HEAL);
  if (healed > 0) addLog(state.log, 'log.descendHeal', { healed }, 'good');
}
