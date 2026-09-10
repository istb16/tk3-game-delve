import type { EffectId, Equipment, EquipmentId, Rarity, Slot, StatMods } from '../core/types';

/**
 * 装備テーブル。バランス調整はこのファイルだけを触る。
 * 数値の根拠は docs/03-game-design.md §3.4。
 */

export interface EquipmentDef {
  id: EquipmentId;
  name: string;
  slot: Slot;
  rarity: Rarity;
  /** この階層以降で出現する */
  minFloor: number;
  mods: StatMods;
  /** 命中時に確率で発動する効果 */
  effect: EffectId | null;
  /** effect の発動率。効果なしなら 0。 */
  effectChance: number;
}

export const EQUIPMENT: readonly EquipmentDef[] = [
  // --- Weapon ---
  { id: 'rustyDagger', name: 'Rusty Dagger', slot: 'weapon', rarity: 'common', minFloor: 1,
    mods: { attack: 2 }, effect: null, effectChance: 0 },
  { id: 'ironSword', name: 'Iron Sword', slot: 'weapon', rarity: 'common', minFloor: 1,
    mods: { attack: 5 }, effect: null, effectChance: 0 },
  { id: 'vampireFang', name: 'Vampire Fang', slot: 'weapon', rarity: 'rare', minFloor: 5,
    mods: { attack: 4, lifesteal: 0.05 }, effect: null, effectChance: 0 },
  { id: 'assassinKris', name: 'Assassin Kris', slot: 'weapon', rarity: 'rare', minFloor: 6,
    mods: { attack: 6, crit: 0.15 }, effect: null, effectChance: 0 },
    { id: 'flameBlade', name: 'Flame Blade', slot: 'weapon', rarity: 'rare', minFloor: 4,
    mods: { attack: 8 }, effect: 'burn', effectChance: 0.1 },
  // 設計書では「命中時に鈍足化」だったが、発動率を付けた。
  // 速度1の敵にとって鈍足は行動を1回飛ばすのと同じで、確定発動だと
  // 単体相手に永久に手番を渡さない完全なハメになる。
  { id: 'wardensMaul', name: "Warden's Maul", slot: 'weapon', rarity: 'epic', minFloor: 9,
    mods: { attack: 12, crit: -0.05 }, effect: 'slow', effectChance: 0.35 },

  // --- Armor ---
  { id: 'leatherVest', name: 'Leather Vest', slot: 'armor', rarity: 'common', minFloor: 1,
    mods: { defense: 2 }, effect: null, effectChance: 0 },
  { id: 'chainMail', name: 'Chain Mail', slot: 'armor', rarity: 'common', minFloor: 3,
    mods: { defense: 4 }, effect: null, effectChance: 0 },
  { id: 'thornPlate', name: 'Thorn Plate', slot: 'armor', rarity: 'rare', minFloor: 6,
    mods: { defense: 5, thorns: 3 }, effect: null, effectChance: 0 },
  { id: 'shadowCloak', name: 'Shadow Cloak', slot: 'armor', rarity: 'rare', minFloor: 7,
    mods: { defense: 3, evasion: 0.12 }, effect: null, effectChance: 0 },

  // --- Ring ---
  { id: 'ringOfVigor', name: 'Ring of Vigor', slot: 'ring', rarity: 'common', minFloor: 2,
    mods: { maxHp: 15 }, effect: null, effectChance: 0 },
  { id: 'ringOfFortune', name: 'Ring of Fortune', slot: 'ring', rarity: 'common', minFloor: 3,
    mods: { goldPct: 0.3 }, effect: null, effectChance: 0 },
  { id: 'ringOfFury', name: 'Ring of Fury', slot: 'ring', rarity: 'rare', minFloor: 4,
    mods: { attackPct: 0.1 }, effect: null, effectChance: 0 },
  { id: 'ringOfInsight', name: 'Ring of Insight', slot: 'ring', rarity: 'rare', minFloor: 5,
    mods: { expPct: 0.2 }, effect: null, effectChance: 0 },
];

/** ドロップしうる装備。Phase 3 で全ての効果を実装したので全件が対象。 */
export const EQUIPMENT_POOL: readonly EquipmentDef[] = EQUIPMENT;

export function equipmentAt(floor: number): readonly EquipmentDef[] {
  const candidates = EQUIPMENT_POOL.filter((e) => e.minFloor <= floor);
  // minFloor の設定ミスで空にならないよう、最低1つは返す
  return candidates.length > 0 ? candidates : EQUIPMENT_POOL.slice(0, 1);
}

export function toEquipment(def: EquipmentDef): Equipment {
  return {
    id: def.id,
    name: def.name,
    slot: def.slot,
    rarity: def.rarity,
    mods: def.mods,
    effect: def.effect,
    effectChance: def.effectChance,
  };
}

/** 確定でレア以上を出す（ボス撃破の報酬など）。 */
export function rareEquipmentAt(floor: number, rng: { pick<T>(x: readonly T[]): T }): Equipment {
  const rare = EQUIPMENT_POOL.filter((e) => e.minFloor <= floor && e.rarity !== 'common');
  const pool = rare.length > 0 ? rare : EQUIPMENT_POOL.filter((e) => e.minFloor <= floor);
  return toEquipment(rng.pick(pool.length > 0 ? pool : EQUIPMENT_POOL));
}

/**
 * 装備の比較。
 *
 * 単一の総合スコアで順序を付けてはいけない。スロットごとに1位が決まってしまい、
 * それを拾った時点で残りの装備が永久に使われなくなる（実測: Ring of Vigor を拾うと
 * 他の3種の指輪が二度と装備されない）。装備がビルドの選択肢でなくなる。
 *
 * 代わりに**支配関係**だけを見る。全項目で劣らず、どこかで勝っていれば 'better'。
 * その逆なら 'worse'。どちらでもない組み合わせ（攻撃力は低いが吸収が付くなど）は
 * 'sidegrade' として、プレイヤーに選ばせる。
 */
export type Comparison = 'better' | 'worse' | 'sidegrade';

const MOD_KEYS = [
  'attack',
  'attackPct',
  'defense',
  'maxHp',
  'crit',
  'evasion',
  'lifesteal',
  'thorns',
  'goldPct',
  'expPct',
] as const satisfies readonly (keyof StatMods)[];

export function compareEquipment(candidate: Equipment, current: Equipment | null): Comparison {
  if (!current) return 'better';

  let anyBetter = false;
  let anyWorse = false;
  for (const key of MOD_KEYS) {
    const a = candidate.mods[key] ?? 0;
    const b = current.mods[key] ?? 0;
    if (a > b) anyBetter = true;
    else if (a < b) anyWorse = true;
  }

  // 命中時の効果も比較軸に入れる。数値が同じでも「燃やせる」武器は別物で、
  // ここを見ないと効果付きの装備が数値だけで下位互換に見えてしまう。
  const aEffect = candidate.effect !== null;
  const bEffect = current.effect !== null;
  if (aEffect !== bEffect) {
    if (aEffect) anyBetter = true;
    else anyWorse = true;
  } else if (aEffect && candidate.effect !== current.effect) {
    // 別種の効果同士は優劣を付けられない
    anyBetter = true;
    anyWorse = true;
  }

  if (anyBetter && !anyWorse) return 'better';
  if (anyWorse && !anyBetter) return 'worse';
  // 完全に同じ場合も 'worse' 扱い。持ち替える意味がないので尋ねない。
  return anyBetter ? 'sidegrade' : 'worse';
}
