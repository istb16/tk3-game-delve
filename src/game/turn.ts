import type { Dir, Enemy, GameState, Intent, PendingChoice, Vec2 } from '../core/types';
import { SWIFT_STEP_CHANCE } from '../core/constants';
import { isWalkable, tileAt, updateVisibility } from './dungeon';
import { actEnemy, enemyAt } from './enemy';
import { playerAttack } from './combat';
import { pickupAt, swapEquipment, useItem } from './loot';
import { equip, hasPerk, takePerk } from './progression';
import { addLog } from '../core/log';
import { descend } from './state';
import { applyEvent } from './events';
import { effectiveSpeed, tickStatuses } from './status';

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
  if (state.phase === 'choosing') {
    if (intent.type === 'choose') resolveChoice(state, intent.index);
    return;
  }
  if (state.phase !== 'playing') return;

  // ターン番号は行動の前に進める。こうするとこのターン中に起きたダメージが
  // すべて同じ番号になり、描画側は「hurtOnTurn === turn」だけで演出を判定できる。
  state.turn += 1;

  const floorBefore = state.floor;
  // 手番を持つのは「プレイヤーが動く前からいた敵」だけ。
  // プレイヤーの行動中に生まれた敵（Slime の分裂、イベントの番人）に
  // その場で手番を与えると、分裂や報酬の受け取りが実質「無料の攻撃」になる。
  const actors = [...state.enemies];
  const consumed = resolvePlayerTurn(state, intent);

  // ターンを消費したかに関わらず視界を更新する。
  // Swift Step は「移動したがターンは消費しない」ので、ここを消費判定の後ろに置くと
  // 動いたのに視界が古いままになる。
  updateVisibility(state.dungeon, state.player.pos);

  // 壁にぶつかっただけで敵に殴られるのは理不尽なので、ターンを消費しない行動では敵は動かない。
  if (!consumed) return;

  // 階段を降りた直後は、新フロアの敵に「到着した瞬間の1手」を与えない。
  const descended = state.floor !== floorBefore;
  if (state.phase === 'playing' && !descended) resolveEnemyTurns(state, actors);

  // 継続効果はターンの最後にまとめて処理する。攻撃のたびに刻むと、
  // 何に削られているのかがログから読み取れなくなる。
  tickStatuses(state);

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
  state.phase = 'choosing';
}

function resolveChoice(state: GameState, index: number): void {
  const choice = state.pendingChoices[0];
  if (!choice) {
    state.phase = 'playing';
    return;
  }

  // 範囲外の入力は無視する。閉じずにもう一度選ばせる。
  if (!applyChoice(state, choice, index)) return;

  state.pendingChoices.shift();
  state.phase = state.pendingChoices.length > 0 ? 'choosing' : 'playing';
}

/** @returns 選択が成立したか（false なら入力が無効で、選択待ちのまま） */
function applyChoice(state: GameState, choice: PendingChoice, index: number): boolean {
  if (choice.kind === 'levelup') {
    const perk = choice.options[index];
    if (!perk) return false;
    takePerk(state, perk);
    return true;
  }

  if (choice.kind === 'event') {
    if (index < 0 || index >= choice.optionCount) return false;
    const entity = state.entities.find((e) => e.id === choice.entityId);
    applyEvent(state, choice.eventId, entity, index);
    // イベントのマスは一度きり。残すと同じ賭けを何度でも引き直せてしまう。
    if (entity) state.entities = state.entities.filter((e) => e !== entity);
    return true;
  }

  // 装備の持ち替え: 0 = 拾った方に持ち替える / 1 = 今のままにする
  const entity = state.entities.find((e) => e.id === choice.entityId);
  if (index === 0) {
    if (entity) {
      if (swapEquipment(state, entity, choice.candidate)) {
        state.entities = state.entities.filter((e) => e !== entity);
      }
    } else {
      // 床から消えている状況は想定していないが、選択待ちで詰ませない
      equip(state.player, choice.candidate);
      addLog(state.log, 'log.equip', { name: choice.candidate.name }, 'good');
    }
    return true;
  }
  if (index === 1) {
    // 同じ比較を繰り返し尋ねないよう、「何に対して断ったか」を記録する
    if (entity && entity.payload.type === 'equipment') {
      entity.payload.declinedAgainst = choice.current.id;
    }
    addLog(state.log, 'log.equipKept', { name: choice.candidate.name }, 'info');
    return true;
  }
  return false;
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

function resolveEnemyTurns(state: GameState, actors: readonly Enemy[]): void {
  for (const enemy of actors) {
    const speed = effectiveSpeed(enemy);
    for (let i = 0; i < speed; i++) {
      if (state.phase !== 'playing') return;
      if (enemy.hp <= 0) break;
      actEnemy(state, enemy, state.rng);
    }
  }
}
