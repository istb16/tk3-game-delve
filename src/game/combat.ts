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
  addLog(state.log, `You hit ${target.name} for ${damage}.`, 'info');

  if (target.hp <= 0) killEnemy(state, target);
}

export function enemyAttack(state: GameState, attacker: Enemy): void {
  const damage = computeDamage(attacker.attack, state.player.defense);
  state.player.hp -= damage;
  addLog(state.log, `${attacker.name} hits you for ${damage}.`, 'bad');

  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.phase = 'dead';
    addLog(state.log, 'You died.', 'system');
  }
}

function killEnemy(state: GameState, target: Enemy): void {
  target.hp = 0;
  state.stats.kills += 1;

  addLog(state.log, `${target.name} dies. +${target.exp} EXP`, 'good');
  gainGold(state, target.gold);
  // gainExp がレベルアップまで処理する（ログもそちらで出る）
  gainExp(state, target.exp);
}
