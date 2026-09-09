import type { Enemy, GameState } from '../core/types';
import { MIN_DAMAGE } from '../core/constants';
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
  const damage = computeDamage(state.player.attack, target.defense);
  target.hp -= damage;
  addLog(state.log, 'log.playerHit', { name: target.name, damage }, 'info');

  if (target.hp <= 0) killEnemy(state, target);
}

export function enemyAttack(state: GameState, attacker: Enemy): void {
  const damage = computeDamage(attacker.attack, state.player.defense);
  state.player.hp -= damage;
  addLog(state.log, 'log.enemyHit', { name: attacker.name, damage }, 'bad');

  if (state.player.hp <= 0) {
    state.player.hp = 0;
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
