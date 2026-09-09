import type { Dungeon, Enemy, GameState, Vec2 } from '../core/types';
import type { EnemyDef } from '../data/enemies';
import type { Rng } from '../core/rng';
import { spawnableAt } from '../data/enemies';
import {
  ENEMY_AGGRO_RANGE,
  MAX_ENEMIES_PER_FLOOR,
  SPAWN_MIN_DISTANCE,
  floorScale,
} from '../core/constants';
import {
  UNREACHABLE,
  bfsDistances,
  chebyshev,
  isWalkable,
  manhattan,
  tileIndex,
} from './dungeon';
import { enemyAttack } from './combat';

let nextEnemyId = 0;

// --- 生成 --------------------------------------------------------------------

export function spawnEnemies(rng: Rng, dungeon: Dungeon, floor: number): Enemy[] {
  const count = Math.min(3 + Math.floor(floor / 2), MAX_ENEMIES_PER_FLOOR);
  const pool = spawnableAt(floor);

  // start から一定距離離れた到達可能マスだけを候補にする。
  // 開幕から選択の余地なく殴られる状況を作らないため。
  const dist = bfsDistances(dungeon, dungeon.start);
  const candidates: Vec2[] = [];
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const d = dist[tileIndex(dungeon, x, y)] ?? UNREACHABLE;
      if (d < SPAWN_MIN_DISTANCE) continue;
      if (x === dungeon.stairs.x && y === dungeon.stairs.y) continue;
      candidates.push({ x, y });
    }
  }
  rng.shuffle(candidates);

  const enemies: Enemy[] = [];
  for (let i = 0; i < count && i < candidates.length; i++) {
    enemies.push(createEnemy(pickWeighted(rng, pool), candidates[i] as Vec2, floor));
  }
  return enemies;
}

function pickWeighted(rng: Rng, pool: readonly EnemyDef[]): EnemyDef {
  const total = pool.reduce((sum, def) => sum + def.weight, 0);
  if (total <= 0) return rng.pick(pool);
  let roll = rng.next() * total;
  for (const def of pool) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return pool[pool.length - 1] as EnemyDef;
}

function createEnemy(def: EnemyDef, pos: Vec2, floor: number): Enemy {
  const scale = floorScale(floor);
  const hp = Math.floor(def.hp * scale);
  return {
    id: `enemy-${nextEnemyId++}`,
    kind: def.kind,
    name: def.name,
    ai: def.ai,
    pos: { ...pos },
    hp,
    maxHp: hp,
    attack: Math.floor(def.attack * scale),
    defense: Math.floor(def.defense * scale),
    speed: def.speed,
    exp: Math.floor(def.exp * scale),
    gold: Math.floor(def.gold * scale),
  };
}

// --- AI ----------------------------------------------------------------------

/**
 * 敵の1ターン。speed の回数だけ呼ばれる。
 *
 * 視界外（ENEMY_AGGRO_RANGE 超）の敵は動かない。処理を軽くするためだけでなく、
 * 「近づくと動き出す」という緊張の立ち上がりを作るため。
 */
export function actEnemy(state: GameState, enemy: Enemy, rng: Rng): void {
  const player = state.player;
  if (enemy.hp <= 0) return;

  if (manhattan(enemy.pos, player.pos) === 1) {
    enemyAttack(state, enemy);
    return;
  }
  if (chebyshev(enemy.pos, player.pos) > ENEMY_AGGRO_RANGE) return;

  // erratic は 40% で気まぐれに動く。Bat の「直進してこない」不気味さを出す。
  const steps =
    enemy.ai === 'erratic' && rng.chance(0.4)
      ? rng.shuffle([...ORTHOGONAL])
      : chaseSteps(enemy.pos, player.pos);

  for (const step of steps) {
    if (moveIfFree(state, enemy, step)) return;
  }
}

const ORTHOGONAL: readonly Vec2[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * プレイヤーへ近づく方向を優先度順に返す。
 * 第1候補が壁で塞がっていても第2候補（もう一方の軸）で回り込めるため、
 * 壁際に貼り付いたまま動けなくなることがない。
 */
function chaseSteps(from: Vec2, to: Vec2): Vec2[] {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const horizontal: Vec2 = { x: dx, y: 0 };
  const vertical: Vec2 = { x: 0, y: dy };

  const preferHorizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const ordered = preferHorizontal ? [horizontal, vertical] : [vertical, horizontal];
  return ordered.filter((step) => step.x !== 0 || step.y !== 0);
}

function moveIfFree(state: GameState, enemy: Enemy, step: Vec2): boolean {
  const nx = enemy.pos.x + step.x;
  const ny = enemy.pos.y + step.y;
  if (!isWalkable(state.dungeon, nx, ny)) return false;
  if (state.player.pos.x === nx && state.player.pos.y === ny) return false;
  if (enemyAt(state.enemies, nx, ny)) return false;
  enemy.pos.x = nx;
  enemy.pos.y = ny;
  return true;
}

export function enemyAt(enemies: readonly Enemy[], x: number, y: number): Enemy | undefined {
  return enemies.find((e) => e.hp > 0 && e.pos.x === x && e.pos.y === y);
}
