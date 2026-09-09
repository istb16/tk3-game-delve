import { describe, expect, it } from 'vitest';
import { summarize } from './helpers/bot';

/**
 * 難易度カーブの受け入れ基準（docs/07 §7.2, docs/08 §8.3）。
 *
 * 「上手くないプレイヤー」が 10〜15 階で終わることを設計目標にしている。
 * バランス数値を変えるとここが落ちる。落ちたら数字を合わせにいくのではなく、
 * まず docs/07 の目標カーブと照らして原因を特定すること。
 */
describe('難易度カーブ', () => {
  it('到達階層の中央値が目標帯（10〜15階）に入る', () => {
    const result = summarize(60);

    expect(result.timedOut, '進行不能になった run がある').toBe(0);
    expect(result.median).toBeGreaterThanOrEqual(10);
    expect(result.median).toBeLessThanOrEqual(15);

    // 序盤で理不尽に死ぬ run は 1 割未満
    expect((result.bands['1-4'] as number) / 60).toBeLessThan(0.1);

    // 深部で無限に潜れてしまわない（スケーリングが効いている）
    expect(result.max).toBeLessThan(40);
  }, 120_000);

  it('回復を無駄に使うと到達階層が下がる（腕が結果に効く）', () => {
    const sloppy = summarize(30, { healBelow: 0.9 });
    const careful = summarize(30, { healBelow: 0.5 });
    expect(careful.mean).toBeGreaterThan(sloppy.mean);
  }, 120_000);
});
