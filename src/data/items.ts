import type { ItemId } from '../core/types';
import { FIRST_RARE_FLOOR } from './equipment';

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
  {
    id: 'scroll',
    name: 'Scroll',
    // 当たりもハズレもある。頻繁に出ると「読むかどうか」の緊張が薄まる
    perFloor: (_floor, roll) => (roll < 0.35 ? 1 : 0),
  },
  {
    id: 'key',
    name: 'Key',
    // 鍵つきの宝箱に出会う頻度と釣り合わせる。余ると持ち歩く意味が消える。
    // 施錠された宝箱が存在しない階では出さない（使い道のない物で枠を埋めない）。
    perFloor: (floor, roll) => (floor >= FIRST_RARE_FLOOR - 1 && roll < 0.4 ? 1 : 0),
  },
];

/**
 * 巻物の効果と重み（docs/03 §3.5）。
 * ハズレを 1 枠だけ混ぜることで「読むかどうか」自体を判断にする。
 */
export type ScrollEffect =
  | 'blast'
  | 'reveal'
  | 'teleport'
  | 'rage'
  | 'banish'
  | 'curse';

export const SCROLL_TABLE: readonly (readonly [ScrollEffect, number])[] = [
  ['blast', 3],
  ['reveal', 3],
  ['teleport', 2],
  ['rage', 2],
  ['banish', 1],
  ['curse', 1],
];
