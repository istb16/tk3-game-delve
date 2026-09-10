import { describe, expect, it } from 'vitest';

import type { LogEntry } from '../src/core/types';
import { TOAST_FADE_MS, TOAST_MAX, TOAST_MS, toastLines } from '../src/ui/toast';

/**
 * トーストの DOM 操作は node 環境では動かせないので、
 * 「どの行を、どの言語で出すか」だけを見る。
 */

let nextId = 0;
function entry(key: LogEntry['key'], tone: LogEntry['tone'], params = {}): LogEntry {
  return { id: nextId++, key, params, tone };
}

describe('トーストに出す行', () => {
  it('ログと同じ文言・同じ色で出す（ログとトーストで別物に見えない）', () => {
    const lines = toastLines([entry('log.floor', 'system', { floor: 3 })], 'ja');
    expect(lines).toEqual([{ text: 'FLOOR 3', tone: 'system' }]);
  });

  it('表示言語に従う', () => {
    const log = [entry('log.pickupGold', 'gold', { amount: 12 })];
    expect(toastLines(log, 'en')[0]?.text).not.toBe(toastLines(log, 'ja')[0]?.text);
  });

  it('上限を超えたら新しい方を残す（古い方は読まれる前に押し出される）', () => {
    const log = [
      entry('log.critical', 'good', { name: 'Rat', damage: 9 }),
      entry('log.enemyDies', 'good', { name: 'Rat' }),
      entry('log.levelUp', 'system', { level: 2 }),
    ];
    const lines = toastLines(log, 'en', 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.tone).toBe('system');
  });

  it('何も起きていないターンでは1件も出さない', () => {
    expect(toastLines([], 'ja')).toEqual([]);
  });
});

describe('トーストの時間', () => {
  it('出しっぱなしにするのは5秒前後', () => {
    expect(TOAST_MS).toBeGreaterThanOrEqual(3000);
    expect(TOAST_MS).toBeLessThanOrEqual(7000);
  });

  it('フェードは表示時間より十分に短い', () => {
    expect(TOAST_FADE_MS).toBeLessThan(TOAST_MS / 2);
  });

  it('同時に積む上限は、1ターンぶんの出来事が収まる程度', () => {
    expect(TOAST_MAX).toBeGreaterThanOrEqual(3);
    expect(TOAST_MAX).toBeLessThanOrEqual(6);
  });
});
