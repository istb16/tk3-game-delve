import { describe, expect, it } from 'vitest';
import { resolveSlotTap } from '../src/ui/input';

/**
 * スロットの操作。
 *
 * ホバーできるかどうかで挙動を変える部分は、DOM を持ち込まずに検査できるよう
 * 純粋関数に切り出してある。
 */
describe('スロットのタップ解決', () => {
  it('ホバーできる環境（マウス）では、いつでも即使用', () => {
    expect(resolveSlotTap(0, null, false)).toEqual({ type: 'use', slot: 0 });
    expect(resolveSlotTap(0, 0, false)).toEqual({ type: 'use', slot: 0 });
    expect(resolveSlotTap(2, 5, false)).toEqual({ type: 'use', slot: 2 });
  });

  it('ホバーできない環境（タッチ）では、1回目は選択で使わない', () => {
    // 即使用にすると、何のアイテムか確かめる手段が「使ってみる」しかなくなる
    expect(resolveSlotTap(0, null, true)).toEqual({ type: 'select', slot: 0 });
  });

  it('同じスロットを2回目でようやく使う', () => {
    expect(resolveSlotTap(0, 0, true)).toEqual({ type: 'use', slot: 0 });
  });

  it('別のスロットを押したら、そちらの選択に移る（使わない）', () => {
    expect(resolveSlotTap(1, 0, true)).toEqual({ type: 'select', slot: 1 });
  });
});
