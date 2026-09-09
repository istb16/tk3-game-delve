import type { ItemId } from '../core/types';

/** アイテムテーブル。効果そのものは game/loot.ts の applyItem が持つ。 */

export interface ItemDef {
  id: ItemId;
  name: string;
  /** 1フロアに落ちている数を返す。0 なら出現しない。 */
  perFloor: (floor: number, roll: number) => number;
}

export const ITEMS: readonly ItemDef[] = [
  {
    id: 'potion',
    name: 'Potion',
    // 深いほどわずかに増やすが、敵の伸びには追いつかせない
    perFloor: (floor) => (floor >= 10 ? 3 : 2),
  },
  {
    id: 'bomb',
    name: 'Bomb',
    // 常時あると立ち回りが単調になるので、半分弱のフロアにだけ置く
    perFloor: (_floor, roll) => (roll < 0.45 ? 1 : 0),
  },
];
