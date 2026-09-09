import type { Dir, GameState, Intent, Vec2 } from '../core/types';
import { SWIFT_STEP_CHANCE } from '../core/constants';
import { isWalkable, tileAt, updateVisibility } from './dungeon';
import { actEnemy, enemyAt } from './enemy';
import { playerAttack } from './combat';
import { pickupAt, useItem } from './loot';
import { hasPerk, takePerk } from './progression';
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
  // 選択待ちの間は選ぶことしかできない。移動でモーダルを素通りできてしまうと、
  // パークを取り損ねたまま進めてしまう。
  if (state.phase === 'levelup') {
    if (intent.type === 'choose') resolveChoice(state, intent.index);
    return;
  }
  if (state.phase !== 'playing') return;

  const floorBefore = state.floor;
  const consumed = resolvePlayerTurn(state, intent);

  // ターンを消費したかに関わらず視界を更新する。
  // Swift Step は「移動したがターンは消費しない」ので、ここを消費判定の後ろに置くと
  // 動いたのに視界が古いままになる。
  updateVisibility(state.dungeon, state.player.pos);

  // 壁にぶつかっただけで敵に殴られるのは理不尽なので、ターンを消費しない行動では敵は動かない。
  if (!consumed) return;

  // 階段を降りた直後は、新フロアの敵に「到着した瞬間の1手」を与えない。
  const descended = state.floor !== floorBefore;
  if (state.phase === 'playing' && !descended) resolveEnemyTurns(state);

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  openNextChoice(state);
}

/**
 * 溜まっている選択待ちがあれば開く。
 *
 * 敵の行動まで終えてから開くのが要点。レベルアップした瞬間に止めると、
 * 選択中に敵の攻撃だけが未解決で残り、閉じた直後にまとめて食らうことになる。
 * 死亡している場合は開かない（死亡画面よりパーク選択が優先されてはいけない）。
 */
function openNextChoice(state: GameState): void {
  if (state.phase !== 'playing') return;
  if (state.pendingChoices.length === 0) return;
  state.phase = 'levelup';
}

function resolveChoice(state: GameState, index: number): void {
  const choice = state.pendingChoices[0];
  if (!choice) {
    state.phase = 'playing';
    return;
  }
  const perk = choice.options[index];
  if (!perk) return; // 範囲外の入力は無視する。閉じずにもう一度選ばせる。

  takePerk(state, perk);
  state.pendingChoices.shift();
  state.phase = state.pendingChoices.length > 0 ? 'levelup' : 'playing';
}

/** @returns ターンを消費したか */
function resolvePlayerTurn(state: GameState, intent: Intent): boolean {
  switch (intent.type) {
    case 'wait':
      return true;
    case 'useItem':
      return useItem(state, intent.slot);
    case 'move':
      return resolveMove(state, DIRECTIONS[intent.dir]);
    case 'choose':
      // 選択待ちでないときの選択入力は無視する（ターンも消費しない）
      return false;
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
  state.player.steps += 1; // 歩行アニメーションのフレーム番号の出典

  pickupAt(state, state.player.pos);

  if (tileAt(state.dungeon, nx, ny) === 'stairs') {
    descend(state);
    return true;
  }

  // Swift Step: たまに移動がタダになる。逃げ切れるかどうかの読みが変わる。
  // 戦闘と階層移動には適用しない（フロア移動がタダになるのは強すぎる）。
  if (hasPerk(state.player, 'swiftStep') && state.rng.chance(SWIFT_STEP_CHANCE)) return false;

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
