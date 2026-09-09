import type { Dir, GameState, Intent, Vec2 } from '../core/types';
import { isWalkable, tileAt, updateVisibility } from './dungeon';
import { actEnemy, enemyAt } from './enemy';
import { playerAttack } from './combat';
import { descend } from './state';

const DIRECTIONS: Record<Dir, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * 1ターンを進める。
 *
 * 入力駆動 - この関数が呼ばれるまで状態は1ミリも進まない。
 * 常時ループを回さないことで、ターン制の「考える時間は無限」という性質が自然に得られる。
 */
export function takeTurn(state: GameState, intent: Intent): void {
  if (state.phase !== 'playing') return;

  const floorBefore = state.floor;
  const consumed = resolvePlayerTurn(state, intent);
  // 壁にぶつかっただけで敵に殴られるのは理不尽なので、ターンを消費しない行動では敵は動かない。
  if (!consumed) return;

  // 階段を降りた直後は、新フロアの敵に「到着した瞬間の1手」を与えない。
  const descended = state.floor !== floorBefore;
  if (state.phase === 'playing' && !descended) resolveEnemyTurns(state);

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  updateVisibility(state.dungeon, state.player.pos);
}

/** @returns ターンを消費したか */
function resolvePlayerTurn(state: GameState, intent: Intent): boolean {
  switch (intent.type) {
    case 'wait':
      return true;
    case 'move':
      return resolveMove(state, DIRECTIONS[intent.dir]);
    case 'restart':
      // リスタートは main.ts が createGame() で処理する。ターンではない。
      return false;
  }
}

function resolveMove(state: GameState, step: Vec2): boolean {
  const nx = state.player.pos.x + step.x;
  const ny = state.player.pos.y + step.y;

  const target = enemyAt(state.enemies, nx, ny);
  if (target) {
    playerAttack(state, target);
    return true;
  }

  if (!isWalkable(state.dungeon, nx, ny)) return false;

  state.player.pos.x = nx;
  state.player.pos.y = ny;

  if (tileAt(state.dungeon, nx, ny) === 'stairs') descend(state);
  return true;
}

function resolveEnemyTurns(state: GameState): void {
  for (const enemy of state.enemies) {
    for (let i = 0; i < enemy.speed; i++) {
      if (state.phase !== 'playing') return;
      if (enemy.hp <= 0) break;
      actEnemy(state, enemy, state.rng);
    }
  }
}
