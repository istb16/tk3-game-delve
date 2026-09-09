import type { GameState, Player, Vec2 } from '../core/types';
import { LEVEL_UP_GAIN, LEVEL_UP_HEAL, PLAYER_BASE, expToNextLevel } from '../core/constants';
import { addLog } from '../core/log';

export function createPlayer(pos: Vec2): Player {
  return {
    id: 'player',
    pos: { ...pos },
    hp: PLAYER_BASE.maxHp,
    maxHp: PLAYER_BASE.maxHp,
    attack: PLAYER_BASE.attack,
    defense: PLAYER_BASE.defense,
    level: 1,
    exp: 0,
    nextExp: expToNextLevel(1),
    gold: 0,
    steps: 0,
  };
}

/**
 * 経験値を加算し、必要なら（複数回の）レベルアップを処理する。
 *
 * Phase 2 でここにパーク選択（phase を 'levelup' にして選択待ちにする）が入る。
 * 現状は自動でステータスだけ伸びる。
 */
export function gainExp(state: GameState, amount: number): void {
  const player = state.player;
  player.exp += amount;

  while (player.exp >= player.nextExp) {
    player.exp -= player.nextExp;
    player.level += 1;
    player.nextExp = expToNextLevel(player.level);

    // 累積加算ではなくレベルから毎回引き直す。defense の +0.5/Lv を
    // 端数を持ち越さずに扱えるため（docs/07 §7.5）。
    const gained = player.level - 1;
    player.maxHp = PLAYER_BASE.maxHp + LEVEL_UP_GAIN.maxHp * gained;
    player.attack = PLAYER_BASE.attack + LEVEL_UP_GAIN.attack * gained;
    player.defense = PLAYER_BASE.defense + Math.floor(LEVEL_UP_GAIN.defense * gained);

    // 全回復にするとポーションの価値が消え、「今使うか取っておくか」の判断が失われる。
    const healed = Math.floor(player.maxHp * LEVEL_UP_HEAL);
    player.hp = Math.min(player.maxHp, player.hp + healed);

    addLog(state.log, 'log.levelUp', { level: player.level, healed }, 'good');
  }
}

export function gainGold(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.player.gold += amount;
  state.stats.goldEarned += amount;
}
