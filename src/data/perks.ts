import type { PerkId, StatMods } from '../core/types';

/**
 * パークテーブル。レベルアップ時に3択から1つ選ぶ（docs/03 §3.6）。
 * 同じパークを重ねて取れるので、尖ったビルドが組める。
 */

export interface PerkDef {
  id: PerkId;
  name: string;
  mods: StatMods;
  /** 選択時に1回だけ起きること（例: Vitality の全回復） */
  onTake?: 'fullHeal';
  /** ステータス補正では表せない、ロジック側で参照するフラグ */
  behavior?: 'treasureSense' | 'swiftStep';
}

export const PERKS: readonly PerkDef[] = [
  { id: 'sharpened', name: 'Sharpened', mods: { attackPct: 0.1 } },
  { id: 'vitality', name: 'Vitality', mods: { maxHp: 15 }, onTake: 'fullHeal' },
  { id: 'deadlyAim', name: 'Deadly Aim', mods: { crit: 0.1 } },
  { id: 'ironhide', name: 'Ironhide', mods: { defense: 2 } },
  { id: 'lifesteal', name: 'Lifesteal', mods: { lifesteal: 0.08 } },
  { id: 'treasureSense', name: 'Treasure Sense', mods: {}, behavior: 'treasureSense' },
  { id: 'swiftStep', name: 'Swift Step', mods: {}, behavior: 'swiftStep' },
];

const BY_ID = new Map(PERKS.map((p) => [p.id, p]));

export function perkDef(id: PerkId): PerkDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`未知のパーク: ${id}`);
  return def;
}

/**
 * Treasure Sense / Swift Step は重ねて取っても意味が薄いので、
 * すでに持っているものは選択肢から外す。攻撃力+10% のような数値系は重複を許す。
 */
export function offerablePerks(taken: readonly PerkId[]): readonly PerkDef[] {
  return PERKS.filter((p) => !p.behavior || !taken.includes(p.id));
}
