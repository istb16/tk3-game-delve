import type { Enemy, GameState } from '../core/types';
import {
  BURN,
  CRIT_MULTIPLIER,
  ENRAGE_MULTIPLIER,
  ENRAGE_THRESHOLD,
  FIRE_DAMAGE_CHANCE,
  MIN_DAMAGE,
  POISON,
  POISON_ATTACK_CHANCE,
  SLOW_TURNS,
} from '../core/constants';
import { addLog } from '../core/log';
import { gainExp, gainGold } from './player';
import { hasPerk } from './progression';
import {
  absorbWithShield,
  applyStatus,
  attackMultiplier,
  damageTakenRatio,
  hasStatus,
} from './status';
import { splitChildren } from './enemy';
import { REVIVE_RATIO } from '../core/constants';

/**
 * ダメージ = 攻撃力 - 防御力、ただし下限 MIN_DAMAGE。
 * 下限を保証するのは「どうやっても倒せない敵」による詰みを作らないため。
 */
export function computeDamage(attack: number, defense: number): number {
  return Math.max(MIN_DAMAGE, attack - defense);
}

export function playerAttack(state: GameState, target: Enemy): void {
  const player = state.player;

  // Bat のような回避持ちは「硬い」のではなく「当たらない」。
  // 与ダメージ0のログを出すより、外れたことを明示した方が納得できる。
  if (target.evasion > 0 && state.rng.chance(target.evasion)) {
    addLog(state.log, 'log.enemyEvaded', { name: target.name }, 'info');
    return;
  }

  const power = Math.floor(player.attack * attackMultiplier(player));
  let damage = computeDamage(power, target.defense);

  const critical = state.rng.chance(player.critChance);
  if (critical) damage = Math.floor(damage * CRIT_MULTIPLIER);

  // 防御態勢は最後に掛ける。クリティカルで抜けるようにすると、
  // 「守りを固めた相手を運で貫く」という気持ちのいい抜け道になる。
  damage = Math.max(MIN_DAMAGE, Math.floor(damage * damageTakenRatio(target)));

  // 命中を先に記録する。damageEnemy は撃破とレベルアップまで処理してログを積むので、
  // 後に回すと「倒した」→「レベルアップ」→「殴った」という因果の逆転した並びになる。
  addLog(
    state.log,
    critical ? 'log.critical' : 'log.playerHit',
    { name: target.name, damage },
    critical ? 'good' : 'info',
  );
  applyOnHitEffects(state, target);
  damageEnemy(state, target, damage);

  // 吸収は与えたダメージに比例する。倒しきった分も含めて数える
  // （倒した瞬間だけ吸えないのは直感に反する）。
  if (player.lifesteal > 0) {
    const healed = Math.min(
      player.maxHp - player.hp,
      Math.max(1, Math.floor(damage * player.lifesteal)),
    );
    if (healed > 0) {
      player.hp += healed;
      addLog(state.log, 'log.lifesteal', { healed }, 'good');
    }
  }
}

/**
 * 命中時の状態異常。武器の効果とパークの両方をここで解決する。
 *
 * ダメージより先に適用するのは、倒しきった相手に毒を塗るログが出るのを避けるため。
 */
function applyOnHitEffects(state: GameState, target: Enemy): void {
  const player = state.player;
  const weapon = player.equipment.weapon;

  if (weapon?.effect === 'burn' && state.rng.chance(weapon.effectChance)) {
    applyStatus(target, 'burn', BURN.turns, BURN.power);
    addLog(state.log, 'log.burned', { name: target.name }, 'good');
  }
  if (weapon?.effect === 'slow' && state.rng.chance(weapon.effectChance)) {
    applyStatus(target, 'slow', SLOW_TURNS, 0);
    addLog(state.log, 'log.slowed', { name: target.name }, 'good');
  }
  if (hasPerk(player, 'fireDamage') && state.rng.chance(FIRE_DAMAGE_CHANCE)) {
    applyStatus(target, 'burn', BURN.turns, BURN.power);
    addLog(state.log, 'log.burned', { name: target.name }, 'good');
  }
  if (hasPerk(player, 'poisonAttack') && state.rng.chance(POISON_ATTACK_CHANCE)) {
    applyStatus(target, 'poison', POISON.turns, POISON.power);
    addLog(state.log, 'log.poisoned', { name: target.name }, 'good');
  }
}

/**
 * 敵に確定ダメージを与え、倒したら報酬まで処理する。
 * 攻撃・爆弾・反射・継続ダメージなど、敵の HP を減らす経路はすべてここを通す。
 */
export function damageEnemy(state: GameState, target: Enemy, damage: number): void {
  if (target.hp <= 0) return;
  target.hp -= damage;

  if (target.hp > 0) {
    checkEnrage(state, target);
    return;
  }
  if (tryRevive(state, target)) return;
  killEnemy(state, target);
}

/** ボスは半分まで削ると本気を出す。山場に「まだ終わっていない」段差を作る。 */
function checkEnrage(state: GameState, target: Enemy): void {
  if (target.ability !== 'boss') return;
  if (hasStatus(target, 'rage')) return;
  if (target.hp > target.maxHp * ENRAGE_THRESHOLD) return;

  // 倍率は rage ステータスにだけ持たせる。attack そのものも書き換えると
  // enemyAttack が attackMultiplier で再び掛けるため、1.5倍のつもりが
  // 2.25倍になる（実測: 攻撃20 の一撃が 45 になっていた）。
  // 持続を極端に長くして実質的に「以降ずっと」にする。
  // 別のフラグを増やすより、既にある仕組みで表現できる方が状態が散らからない。
  applyStatus(target, 'rage', 9999, ENRAGE_MULTIPLIER);
  addLog(state.log, 'log.enraged', { name: target.name }, 'bad');
}

/** @returns 復活したか（復活したなら撃破処理をしない） */
function tryRevive(state: GameState, target: Enemy): boolean {
  if (target.ability !== 'revive' || target.revived) return false;

  target.revived = true;
  target.hp = Math.max(1, Math.floor(target.maxHp * REVIVE_RATIO));
  target.effects = [];
  addLog(state.log, 'log.revived', { name: target.name }, 'bad');
  return true;
}

export function enemyAttack(state: GameState, attacker: Enemy): void {
  const player = state.player;

  if (player.evasion > 0 && state.rng.chance(player.evasion)) {
    addLog(state.log, 'log.evaded', { name: attacker.name }, 'good');
    return;
  }

  const power = Math.floor(attacker.attack * attackMultiplier(attacker));
  const damage = computeDamage(power, player.defense);

  if (absorbWithShield(state)) return;

  player.hp -= damage;
  addLog(state.log, 'log.enemyHit', { name: attacker.name, damage }, 'bad');

  // 反射は被弾が成立したときだけ。回避したのに棘が刺さるのはおかしい。
  // ここも命中ログが先（damageEnemy が撃破ログを積むため）。
  if (player.thorns > 0 && attacker.hp > 0) {
    addLog(state.log, 'log.thorns', { name: attacker.name, damage: player.thorns }, 'info');
    damageEnemy(state, attacker, player.thorns);
  }

  if (player.hp <= 0) {
    player.hp = 0;
    state.phase = 'dead';
    addLog(state.log, 'log.died', {}, 'system');
  }
}

function killEnemy(state: GameState, target: Enemy): void {
  target.hp = 0;
  state.stats.kills += 1;
  if (target.ability === 'boss') state.stats.bossKills += 1;

  addLog(state.log, 'log.enemyDies', { name: target.name, exp: target.exp }, 'good');

  // Slime は倒した瞬間に分裂する。「倒した」が「片付いた」を意味しない敵。
  if (target.ability === 'split' && !target.split) {
    const children = splitChildren(target, state);
    if (children.length > 0) {
      state.enemies.push(...children);
      addLog(state.log, 'log.split', { name: target.name, count: children.length }, 'bad');
    }
  }

  gainGold(state, target.gold);
  // gainExp がレベルアップまで処理する（ログもそちらで出る）
  gainExp(state, target.exp);
}
