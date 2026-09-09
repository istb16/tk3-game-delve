import type { GameState, Player, Vec2 } from '../core/types';
import { LEVEL_UP_GAIN, PLAYER_BASE, expToNextLevel } from '../core/constants';
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

    player.maxHp += LEVEL_UP_GAIN.maxHp;
    player.attack += LEVEL_UP_GAIN.attack;
    player.defense += LEVEL_UP_GAIN.defense;
    // レベルアップは全回復を兼ねる。深く潜り続ける動機になる。
    player.hp = player.maxHp;

    addLog(state.log, `LEVEL UP! You are now Lv ${player.level}.`, 'good');
  }
}

export function gainGold(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.player.gold += amount;
  state.stats.goldEarned += amount;
}
