import { ITEMS } from '../../src/data/items';

/**
 * テスト側で「期待値」を独立に導出するための小道具。
 * 実装の関数をそのまま呼ぶと同じ式を2回書いているだけになり、何も検証しない。
 */
export function potionsPerFloorForTest(floor: number): number {
  const potion = ITEMS.find((i) => i.id === 'potion');
  if (!potion) throw new Error('potion が定義されていない');
  // roll は使わない定義なので 0 を渡す
  return potion.perFloor(floor, 0);
}
