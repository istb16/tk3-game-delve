import type { Dungeon, Enemy, EnemyKind, GameState, Vec2 } from '../core/types';
import type { EnemyDef } from '../data/enemies';
import type { Rng } from '../core/rng';
import { ENEMIES, SPAWN_POOL, bossDef, spawnWeight } from '../data/enemies';
import {
  ENEMY_AGGRO_RANGE,
  GUARD_CHANCE,
  SPAWN_MIN_DISTANCE,
  SPLIT_COUNT,
  SPLIT_RATIO,
  atkScale,
  defScale,
  enemyCountFor,
  hpScale,
  isBossFloor,
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
import { applyStatus, hasStatus } from './status';
import { addLog } from '../core/log';

let nextEnemyId = 0;

// --- 生成 --------------------------------------------------------------------

export function spawnEnemies(rng: Rng, dungeon: Dungeon, floor: number): Enemy[] {
  const boss = isBossFloor(floor);
  // ボス階では雑魚を減らす。ボスと群れの両方を同時に相手取らせると、
  // 「ボスとの一騎打ち」という山場が群れに埋もれる。
  const count = boss ? Math.max(2, enemyCountFor(floor) - 3) : enemyCountFor(floor);

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
    enemies.push(createEnemy(pickWeighted(rng, floor), candidates[i] as Vec2, floor));
  }

  // ボスは最後に、プレイヤーから最も遠いマスへ置く。
  // 降りた瞬間に鉢合わせると、準備する余地がないまま山場が終わる。
  if (boss) {
    const spot = farthestCandidate(dungeon, dist, enemies);
    if (spot) enemies.push(createEnemy(bossDef(), spot, floor));
  }
  return enemies;
}

function farthestCandidate(
  dungeon: Dungeon,
  dist: readonly number[],
  taken: readonly Enemy[],
): Vec2 | null {
  const occupied = new Set(taken.map((e) => tileIndex(dungeon, e.pos.x, e.pos.y)));
  let best: Vec2 | null = null;
  let bestDist = -1;
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const i = tileIndex(dungeon, x, y);
      if (occupied.has(i)) continue;
      const d = dist[i] ?? UNREACHABLE;
      if (d > bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

/**
 * 深度に応じた重みで敵を1体選ぶ。
 *
 * 十分に深いとガウス重みが全て 0 に潰れるため、その場合は
 * 最も深い階層を担当する敵にフォールバックする（無限に潜れる設計のため必須）。
 */
function pickWeighted(rng: Rng, floor: number): EnemyDef {
  const weights = SPAWN_POOL.map((def) => spawnWeight(def, floor));
  const total = weights.reduce((sum, w) => sum + w, 0);

  // 重みが全て 0 になるのは「深すぎてガウスが潰れた」ときだけであってほしい。
  // minFloor で弾かれた結果ではないことを、出現可能な候補に絞ってから判定する。
  const allowed = SPAWN_POOL.filter((def) => def.minFloor <= floor);
  if (total <= 0) return deepestOf(allowed.length > 0 ? allowed : SPAWN_POOL);

  let roll = rng.next() * total;
  for (let i = 0; i < SPAWN_POOL.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return SPAWN_POOL[i] as EnemyDef;
  }
  return SPAWN_POOL[SPAWN_POOL.length - 1] as EnemyDef;
}

function deepestOf(pool: readonly EnemyDef[]): EnemyDef {
  let best = pool[0];
  if (!best) throw new Error('SPAWN_POOL が空');
  for (const def of pool) if (def.peakFloor > best.peakFloor) best = def;
  return best;
}

function createEnemy(def: EnemyDef, pos: Vec2, floor: number): Enemy {
  // HP / 攻撃 / 防御で係数を分ける。防御が最も緩やかなのは docs/07 §7.4 レバー1 の通り。
  const hp = Math.floor(def.hp * hpScale(floor));
  return {
    id: `enemy-${nextEnemyId++}`,
    kind: def.kind,
    name: def.name,
    ai: def.ai,
    pos: { ...pos },
    hp,
    maxHp: hp,
    attack: Math.floor(def.attack * atkScale(floor)),
    defense: Math.floor(def.defense * defScale(floor)),
    speed: def.speed,
    exp: Math.floor(def.exp * hpScale(floor)),
    gold: Math.floor(def.gold * hpScale(floor)),
    steps: 0,
    hurtOnTurn: -1,
    lastDamage: 0,
    effects: [],
    evasion: def.evasion,
    ability: def.ability,
    revived: false,
    split: false,
  };
}

/**
 * Slime の分裂で生まれる子。親の半分の HP で、二度と分裂しない。
 * 分裂が連鎖すると1体から際限なく増え、フロアが Slime で埋まる。
 */
export function splitChildren(parent: Enemy, state: GameState): Enemy[] {
  const children: Enemy[] = [];
  const spots = freeNeighbors(state, parent.pos, SPLIT_COUNT);
  const hp = Math.max(1, Math.floor(parent.maxHp * SPLIT_RATIO));

  for (const pos of spots) {
    children.push({
      ...parent,
      id: `enemy-${nextEnemyId++}`,
      pos: { ...pos },
      hp,
      maxHp: hp,
      // 経験値とゴールドも半分。分裂で総取得量が増えると稼ぎ場になる。
      exp: Math.floor(parent.exp / 2),
      gold: Math.floor(parent.gold / 2),
      effects: [],
      steps: 0,
      split: true,
    });
  }
  return children;
}

/**
 * イベントの対価として敵を湧かせる。
 *
 * プレイヤーの隣には置かない — 「報酬を受け取った瞬間に囲まれていた」は
 * リスクではなく事故。近づいてくる余地を残す。
 *
 * 種類を指定しても minFloor は破らない。イベント経由なら出してよい、という
 * 抜け道を作ると「出現階」の保証がその1箇所だけ嘘になる。
 * @returns 実際に湧いた数
 */
export function spawnGuardian(state: GameState, count: number, kind?: EnemyKind): number {
  const requested = kind ? ENEMIES.find((e) => e.kind === kind) : undefined;
  const def = requested && requested.minFloor <= state.floor ? requested : null;
  const dist = bfsDistances(state.dungeon, state.player.pos);

  const spots: Vec2[] = [];
  for (let y = 0; y < state.dungeon.height; y++) {
    for (let x = 0; x < state.dungeon.width; x++) {
      const d = dist[tileIndex(state.dungeon, x, y)] ?? UNREACHABLE;
      if (d < 3) continue;
      if (enemyAt(state.enemies, x, y)) continue;
      spots.push({ x, y });
    }
  }
  state.rng.shuffle(spots);

  let added = 0;
  for (let i = 0; i < count && i < spots.length; i++) {
    const chosen = def ?? pickWeighted(state.rng, state.floor);
    state.enemies.push(createEnemy(chosen as EnemyDef, spots[i] as Vec2, state.floor));
    added += 1;
  }
  return added;
}

function freeNeighbors(state: GameState, from: Vec2, limit: number): Vec2[] {
  const found: Vec2[] = [];
  for (const step of ORTHOGONAL) {
    if (found.length >= limit) break;
    const x = from.x + step.x;
    const y = from.y + step.y;
    if (!isWalkable(state.dungeon, x, y)) continue;
    if (state.player.pos.x === x && state.player.pos.y === y) continue;
    if (enemyAt(state.enemies, x, y)) continue;
    found.push({ x, y });
  }
  return found;
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

  // Warden は隣接時に守りを固める。攻撃を1回捨てる代わりに硬くなる交換。
  if (
    enemy.ability === 'guard' &&
    manhattan(enemy.pos, player.pos) === 1 &&
    !hasStatus(enemy, 'guard') &&
    rng.chance(GUARD_CHANCE)
  ) {
    applyStatus(enemy, 'guard', 2, 0);
    addLog(state.log, 'log.guarded', { name: enemy.name }, 'info');
    return;
  }

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
  enemy.steps += 1; // 歩行アニメーションのフレーム番号の出典
  return true;
}

export function enemyAt(enemies: readonly Enemy[], x: number, y: number): Enemy | undefined {
  return enemies.find((e) => e.hp > 0 && e.pos.x === x && e.pos.y === y);
}
