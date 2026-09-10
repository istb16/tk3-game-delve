import type { Actor, GameState, StatusEffect, StatusKind } from '../core/types';
import { GUARD_REDUCTION, SHIELD_COOLDOWN } from '../core/constants';
import { addLog } from '../core/log';
import { damageEnemy } from './combat';
import { hasPerk } from './progression';

/**
 * 継続効果の適用と経過。
 *
 * 「今すぐ効く」ものはここを通さない。時間をまたいで効くものだけを状態として持つ。
 * 効果の解決順は毎ターン固定（プレイヤー -> 敵）にして、同じ盤面から
 * 同じ結果が出ることを保証する。
 */

export function applyStatus(target: Actor, kind: StatusKind, turns: number, power: number): void {
  const existing = target.effects.find((e) => e.kind === kind);
  if (existing) {
    // 重ねがけは「長い方・強い方」を採る。加算にすると1体に集中して撃つだけの
    // 単調な最適解ができてしまう。
    existing.turns = Math.max(existing.turns, turns);
    existing.power = Math.max(existing.power, power);
    return;
  }
  target.effects.push({ kind, turns, power });
}

export function hasStatus(target: Actor, kind: StatusKind): boolean {
  return target.effects.some((e) => e.kind === kind && e.turns > 0);
}

export function statusPower(target: Actor, kind: StatusKind): number {
  return target.effects.find((e) => e.kind === kind && e.turns > 0)?.power ?? 0;
}

/** 鈍足を織り込んだ、このターンの行動回数。 */
export function effectiveSpeed(enemy: Actor & { speed: number }): number {
  return hasStatus(enemy, 'slow') ? Math.max(0, enemy.speed - 1) : enemy.speed;
}

/** 攻撃力に掛かる倍率（Rage の巻物など）。 */
export function attackMultiplier(actor: Actor): number {
  const rage = statusPower(actor, 'rage');
  return rage > 0 ? rage : 1;
}

/** 防御態勢による被ダメージ軽減率。 */
export function damageTakenRatio(actor: Actor): number {
  return hasStatus(actor, 'guard') ? GUARD_REDUCTION : 1;
}

// --- 経過 --------------------------------------------------------------------

/**
 * 1ターン分の継続効果を処理する。ターンの最後に1回だけ呼ぶ。
 *
 * 毒と火傷のダメージはここでまとめて入る。攻撃のたびに刻むと、
 * 「何に削られているのか」がログから読み取れなくなる。
 */
export function tickStatuses(state: GameState): void {
  tickPlayer(state);
  if (state.phase !== 'playing') return;
  tickEnemies(state);

  if (state.player.shieldCooldown > 0) state.player.shieldCooldown -= 1;
}

function tickPlayer(state: GameState): void {
  const player = state.player;
  const damage = dotDamage(player);

  if (damage > 0) {
    player.hp -= damage;
    player.hurtOnTurn = state.turn;
    player.lastDamage = damage;
    addLog(state.log, 'log.statusTick', { damage }, 'bad');
    if (player.hp <= 0) {
      player.hp = 0;
      state.phase = 'dead';
      addLog(state.log, 'log.died', {}, 'system');
    }
  }
  expire(player);
}

function tickEnemies(state: GameState): void {
  // 継続ダメージでの撃破も damageEnemy を通す。経験値とゴールドが入る。
  for (const enemy of [...state.enemies]) {
    if (enemy.hp <= 0) continue;
    const damage = dotDamage(enemy);
    if (damage > 0) damageEnemy(state, enemy, damage);
    expire(enemy);
  }
}

function dotDamage(actor: Actor): number {
  let total = 0;
  for (const effect of actor.effects) {
    if (effect.turns <= 0) continue;
    if (effect.kind === 'poison' || effect.kind === 'burn') total += effect.power;
  }
  return total;
}

function expire(actor: Actor): void {
  for (const effect of actor.effects) effect.turns -= 1;
  actor.effects = actor.effects.filter((e) => e.turns > 0);
}

// --- シールド ----------------------------------------------------------------

/**
 * Shield パークによる無効化。
 * @returns 被弾を打ち消したか
 */
export function absorbWithShield(state: GameState): boolean {
  const player = state.player;
  if (!hasPerk(player, 'shield')) return false;
  if (player.shieldCooldown > 0) return false;

  player.shieldCooldown = SHIELD_COOLDOWN;
  addLog(state.log, 'log.shieldBlocked', {}, 'good');
  return true;
}

export function createEffects(): StatusEffect[] {
  return [];
}
