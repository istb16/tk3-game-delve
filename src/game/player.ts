import type { GameState, Player, Vec2 } from '../core/types';
import { LEVEL_UP_HEAL, PLAYER_BASE, expToNextLevel } from '../core/constants';
import { addLog } from '../core/log';
import { createInventory } from './loot';
import { recalcStats, rollPerkOptions } from './progression';

export function createPlayer(pos: Vec2): Player {
  const player: Player = {
    id: 'player',
    pos: { ...pos },
    hp: PLAYER_BASE.maxHp,
    maxHp: PLAYER_BASE.maxHp,
    attack: PLAYER_BASE.attack,
    defense: PLAYER_BASE.defense,
    level: 1,
    exp: 0,
    leveledOnTurn: -1,
    nextExp: expToNextLevel(1),
    gold: 0,
    steps: 0,
    hurtOnTurn: -1,
    lastDamage: 0,
    inventory: createInventory(),
    equipment: { weapon: null, armor: null, ring: null },
    perks: [],
    bonuses: {},
    shieldCooldown: 0,
    effects: [],
    critChance: 0,
    evasion: 0,
    lifesteal: 0,
    thorns: 0,
    goldPct: 0,
    expPct: 0,
  };
  // 派生値の初期化も recalcStats に任せる。初期値だけ別経路で組み立てると
  // 「装備を1つも着けていないときだけ値がずれる」種類のバグが入る。
  recalcStats(player);
  player.hp = player.maxHp;
  return player;
}

/**
 * 経験値を加算し、必要なら（複数回の）レベルアップを処理する。
 *
 * レベルアップごとにパークの選択肢を1つ積む。1ターンで2レベル上がることが
 * あるので、選択は列で持って順に消化する。
 */
export function gainExp(state: GameState, amount: number): void {
  const player = state.player;
  // 切り捨てだと小さい経験値で Ring of Insight (+20%) が消える（3 -> floor(3.6) = 3）。
  // 四捨五入にして、プラスの補正なら最低 +1 を保証する。
  const bonus = player.expPct > 0 ? Math.max(amount + 1, Math.round(amount * (1 + player.expPct))) : amount;
  player.exp += Math.max(0, bonus);

  while (player.exp >= player.nextExp) {
    player.exp -= player.nextExp;
    player.level += 1;
    player.nextExp = expToNextLevel(player.level);
    player.leveledOnTurn = state.turn;

    // レベルによる基礎値の変化も recalcStats がレベルから引き直す。
    // ここで直接 maxHp などを触ると、装備の補正と二重に足されてしまう。
    recalcStats(player);

    // 全回復にするとポーションの価値が消え、「今使うか取っておくか」の判断が失われる。
    const healed = Math.min(player.maxHp - player.hp, Math.floor(player.maxHp * LEVEL_UP_HEAL));
    player.hp += healed;

    addLog(state.log, 'log.levelUp', { level: player.level, healed }, 'good');

    state.pendingChoices.push({
      kind: 'levelup',
      level: player.level,
      options: rollPerkOptions(state.rng, player),
    });
  }
}

/** 装備の補正を掛けたうえでゴールドを加算し、実際に得た量を返す。 */
export function gainGold(state: GameState, amount: number): number {
  if (amount <= 0) return 0;
  const gained = Math.max(1, Math.floor(amount * (1 + state.player.goldPct)));
  state.player.gold += gained;
  state.stats.goldEarned += gained;
  return gained;
}
