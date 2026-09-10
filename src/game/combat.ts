import type { Enemy, GameState } from '../core/types';
import { CRIT_MULTIPLIER, MIN_DAMAGE } from '../core/constants';
import { addLog } from '../core/log';
import { gainExp, gainGold } from './player';

/**
 * ダメージ = 攻撃力 - 防御力、ただし下限 MIN_DAMAGE。
 * 下限を保証するのは「どうやっても倒せない敵」による詰みを作らないため。
 */
export function computeDamage(attack: number, defense: number): number {
  return Math.max(MIN_DAMAGE, attack - defense);
}

export function playerAttack(state: GameState, target: Enemy): void {
  const player = state.player;
  let damage = computeDamage(player.attack, target.defense);

  const critical = state.rng.chance(player.critChance);
  if (critical) damage = Math.floor(damage * CRIT_MULTIPLIER);

  // 命中を先に記録する。damageEnemy は撃破とレベルアップまで処理してログを積むので、
  // 後に回すと「倒した」→「レベルアップ」→「殴った」という因果の逆転した並びになる。
  addLog(
    state.log,
    critical ? 'log.critical' : 'log.playerHit',
    { name: target.name, damage },
    critical ? 'good' : 'info',
  );
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
 * 敵に確定ダメージを与え、倒したら報酬まで処理する。
 * 攻撃・爆弾・反射など、敵の HP を減らす経路はすべてここを通す。
 */
export function damageEnemy(state: GameState, target: Enemy, damage: number): void {
  if (target.hp <= 0) return;
  target.hp -= damage;
  if (target.hp <= 0) killEnemy(state, target);
}

export function enemyAttack(state: GameState, attacker: Enemy): void {
  const player = state.player;

  if (player.evasion > 0 && state.rng.chance(player.evasion)) {
    addLog(state.log, 'log.evaded', { name: attacker.name }, 'good');
    return;
  }

  const damage = computeDamage(attacker.attack, player.defense);
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

  addLog(state.log, 'log.enemyDies', { name: target.name, exp: target.exp }, 'good');
  gainGold(state, target.gold);
  // gainExp がレベルアップまで処理する（ログもそちらで出る）
  gainExp(state, target.exp);
}
