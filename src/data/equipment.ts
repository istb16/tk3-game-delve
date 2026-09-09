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
  /**
   * 特殊効果。null 以外は未実装なのでドロップ候補から外す。
   * 敵の ability と同じ規律 — 設計書が約束した挙動を持たない物を出さない。
   */
  effect: EffectId | null;
}

export const EQUIPMENT: readonly EquipmentDef[] = [
  // --- Weapon ---
  { id: 'rustyDagger', name: 'Rusty Dagger', slot: 'weapon', rarity: 'common', minFloor: 1,
    mods: { attack: 2 }, effect: null },
  { id: 'ironSword', name: 'Iron Sword', slot: 'weapon', rarity: 'common', minFloor: 1,
    mods: { attack: 5 }, effect: null },
  { id: 'vampireFang', name: 'Vampire Fang', slot: 'weapon', rarity: 'rare', minFloor: 5,
    mods: { attack: 4, lifesteal: 0.05 }, effect: null },
  { id: 'assassinKris', name: 'Assassin Kris', slot: 'weapon', rarity: 'rare', minFloor: 6,
    mods: { attack: 6, crit: 0.15 }, effect: null },
  // 継続ダメージ・鈍足はステータス効果（Phase 3）が要る
  { id: 'flameBlade', name: 'Flame Blade', slot: 'weapon', rarity: 'rare', minFloor: 4,
    mods: { attack: 8 }, effect: 'burn' },
  { id: 'wardensMaul', name: "Warden's Maul", slot: 'weapon', rarity: 'epic', minFloor: 9,
    mods: { attack: 12, crit: -0.05 }, effect: 'slow' },

  // --- Armor ---
  { id: 'leatherVest', name: 'Leather Vest', slot: 'armor', rarity: 'common', minFloor: 1,
    mods: { defense: 2 }, effect: null },
  { id: 'chainMail', name: 'Chain Mail', slot: 'armor', rarity: 'common', minFloor: 3,
    mods: { defense: 4 }, effect: null },
  { id: 'thornPlate', name: 'Thorn Plate', slot: 'armor', rarity: 'rare', minFloor: 6,
    mods: { defense: 5, thorns: 3 }, effect: null },
  { id: 'shadowCloak', name: 'Shadow Cloak', slot: 'armor', rarity: 'rare', minFloor: 7,
    mods: { defense: 3, evasion: 0.12 }, effect: null },

  // --- Ring ---
  { id: 'ringOfVigor', name: 'Ring of Vigor', slot: 'ring', rarity: 'common', minFloor: 2,
    mods: { maxHp: 15 }, effect: null },
  { id: 'ringOfFortune', name: 'Ring of Fortune', slot: 'ring', rarity: 'common', minFloor: 3,
    mods: { goldPct: 0.3 }, effect: null },
  { id: 'ringOfFury', name: 'Ring of Fury', slot: 'ring', rarity: 'rare', minFloor: 4,
    mods: { attackPct: 0.1 }, effect: null },
  { id: 'ringOfInsight', name: 'Ring of Insight', slot: 'ring', rarity: 'rare', minFloor: 5,
    mods: { expPct: 0.2 }, effect: null },
];

/** 効果が実装済みで、実際にドロップしうる装備。 */
export const EQUIPMENT_POOL: readonly EquipmentDef[] = EQUIPMENT.filter((e) => e.effect === null);

export function equipmentAt(floor: number): readonly EquipmentDef[] {
  const candidates = EQUIPMENT_POOL.filter((e) => e.minFloor <= floor);
  // minFloor の設定ミスで空にならないよう、最低1つは返す
  return candidates.length > 0 ? candidates : EQUIPMENT_POOL.slice(0, 1);
}

export function toEquipment(def: EquipmentDef): Equipment {
  return { id: def.id, name: def.name, slot: def.slot, rarity: def.rarity, mods: def.mods };
}

/**
 * 装備の比較に使う概算スコア。
 *
 * 「拾った方が強ければ自動で入れ替える」ための順序付けであって、
 * 厳密な強さではない。攻撃力1相当を基準に各補正を換算している。
 */
export function equipmentScore(equipment: Equipment | null): number {
  if (!equipment) return -1;
  const m = equipment.mods;
  return (
    (m.attack ?? 0) * 1 +
    (m.attackPct ?? 0) * 20 +
    (m.defense ?? 0) * 1.5 +
    (m.maxHp ?? 0) * 0.2 +
    (m.crit ?? 0) * 20 +
    (m.evasion ?? 0) * 25 +
    (m.lifesteal ?? 0) * 40 +
    (m.thorns ?? 0) * 0.8 +
    (m.goldPct ?? 0) * 3 +
    (m.expPct ?? 0) * 8
  );
}
