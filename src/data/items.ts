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
    // 1フロア1本を基本にする。
    //
    // 以前は毎フロア2本（10階以降3本）だったが、実測すると死亡時に
    // 回復を4個以上抱えている run が 60 回中 16 回あった。
    // 余るほど配ると「今使うか取っておくか」の判断が消え、
    // ただ拾い集めるだけの作業になる。
    perFloor: (floor) => (floor >= 12 ? 2 : 1),
  },
  {
    id: 'elixir',
    name: 'Elixir',
    // Potion より深い階から、控えめな頻度で。常に手元にあると
    // 「取っておく」判断が生まれない。
    perFloor: (floor, roll) => (floor >= 4 && roll < 0.25 ? 1 : 0),
  },
  {
    id: 'bomb',
    name: 'Bomb',
    // 状況を選ぶ道具なので使われずに溜まりやすい。
    // 実測で死亡時に平均 4.2 個抱えていたため頻度を下げた。
    perFloor: (_floor, roll) => (roll < 0.25 ? 1 : 0),
  },
  {
    id: 'scroll',
    name: 'Scroll',
    // 当たりもハズレもある。頻繁に出ると「読むかどうか」の緊張が薄まる。
    // 実測で死亡時に平均 3.2 個抱えていたため頻度を下げた。
    perFloor: (_floor, roll) => (roll < 0.22 ? 1 : 0),
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
