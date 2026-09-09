import type { Equipment, GameState, PerkId, Player, StatMods } from '../core/types';
import type { Rng } from '../core/rng';
import { LEVEL_UP_GAIN, PERK_CHOICES, PLAYER_BASE, BASE_CRIT } from '../core/constants';
import { addLog } from '../core/log';
import { offerablePerks, perkDef } from '../data/perks';

/**
 * レベル・装備・パークからプレイヤーの派生値を引き直す。
 *
 * 累積加算ではなく毎回ゼロから組み立てるのが要点。装備を外したときに
 * 補正を引き忘れる、という種類のバグが構造的に起きなくなる。
 * ここが player の派生値を書き換える唯一の場所。
 */
export function recalcStats(player: Player): void {
  const gained = player.level - 1;

  // 1. レベルによる基礎値
  let maxHp = PLAYER_BASE.maxHp + LEVEL_UP_GAIN.maxHp * gained;
  let attack = PLAYER_BASE.attack + LEVEL_UP_GAIN.attack * gained;
  let defense = PLAYER_BASE.defense + Math.floor(LEVEL_UP_GAIN.defense * gained);

  let attackPct = 0;
  let crit = BASE_CRIT;
  let evasion = 0;
  let lifesteal = 0;
  let thorns = 0;
  let goldPct = 0;
  let expPct = 0;

  const apply = (mods: StatMods): void => {
    attack += mods.attack ?? 0;
    attackPct += mods.attackPct ?? 0;
    defense += mods.defense ?? 0;
    maxHp += mods.maxHp ?? 0;
    crit += mods.crit ?? 0;
    evasion += mods.evasion ?? 0;
    lifesteal += mods.lifesteal ?? 0;
    thorns += mods.thorns ?? 0;
    goldPct += mods.goldPct ?? 0;
    expPct += mods.expPct ?? 0;
  };

  // 2. 装備
  for (const equipment of Object.values(player.equipment)) {
    if (equipment) apply(equipment.mods);
  }

  // 3. パーク（重複取得ぶんはそのまま積み上がる）
  for (const perk of player.perks) apply(perkDef(perk).mods);

  // 乗算は加算をすべて足した後に掛ける。順序を変えると装備の付け外しで値がずれる。
  player.maxHp = Math.max(1, Math.floor(maxHp));
  player.attack = Math.max(1, applyPercent(attack, attackPct));
  player.defense = Math.max(0, Math.floor(defense));
  player.critChance = clamp01(crit);
  player.evasion = clamp01(evasion);
  player.lifesteal = clamp01(lifesteal);
  player.thorns = Math.max(0, thorns);
  player.goldPct = goldPct;
  player.expPct = expPct;

  // 最大HPが下がった場合に現在HPが超過したままにならないようにする。
  // 逆に増えた分を勝手に回復させることはしない（回復は資源なので、無償では配らない）。
  player.hp = Math.min(player.hp, player.maxHp);
}

/**
 * 割合補正を適用する。
 *
 * 切り捨てだと低い値でまるごと消える。攻撃力8で +10% は floor(8.8) = 8 になり、
 * 「Attack +10%」を選んだのに数字が1も動かない。四捨五入にしたうえで、
 * プラスの補正なら最低 +1 を保証する — 選んだ効果が見えないパークは、
 * 効果が薄いのではなく壊れている。
 */
function applyPercent(base: number, percent: number): number {
  const scaled = Math.round(base * (1 + percent));
  if (percent > 0) return Math.max(base + 1, scaled);
  return scaled;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// --- パークの選択 ------------------------------------------------------------

/** レベルアップ時に提示する選択肢を抽選する。 */
export function rollPerkOptions(rng: Rng, player: Player): PerkId[] {
  const pool = [...offerablePerks(player.perks)];
  rng.shuffle(pool);
  return pool.slice(0, PERK_CHOICES).map((p) => p.id);
}

/** 選んだパークを適用する。 */
export function takePerk(state: GameState, perk: PerkId): void {
  const player = state.player;
  player.perks.push(perk);
  recalcStats(player);

  const def = perkDef(perk);
  if (def.onTake === 'fullHeal') player.hp = player.maxHp;

  addLog(state.log, 'log.perkTaken', { perk: def.name }, 'good');
}

export function hasPerk(player: Player, perk: PerkId): boolean {
  return player.perks.includes(perk);
}

// --- 装備 --------------------------------------------------------------------

/**
 * 装備する。同じスロットに既に何かあれば、それを返す（呼び出し側が床に置く）。
 */
export function equip(player: Player, equipment: Equipment): Equipment | null {
  const previous = player.equipment[equipment.slot];
  player.equipment[equipment.slot] = equipment;
  recalcStats(player);
  return previous;
}
