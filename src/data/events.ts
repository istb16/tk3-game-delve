import type { EventId } from '../core/types';

/**
 * ランダムイベントの定義（docs/03 §3.7）。
 *
 * ここが持つのは「何を提示するか」だけ。効果は game/events.ts が持つ。
 * 効果を関数として state に入れてしまうと、状態が素のデータでなくなり、
 * 保存も再現もできなくなる。
 */

export interface EventDef {
  id: EventId;
  /** 選択肢の数。1つ目が「受ける」、最後が常に「立ち去る」。 */
  optionCount: number;
  /** この階層以降で発生する */
  minFloor: number;
  weight: number;
}

/**
 * 恒久的な代償を持つイベント（Shrine の最大HP -10、Cursed Chest の罠）は
 * 浅い階には出さない。
 *
 * 最大HP -10 は 2階（最大HP 40）では -25% だが、12階（84）では -12% で、
 * **同じ代償が浅いほど重い**。しかも序盤はまだビルドが無く、
 * 何と引き換えているのかを判断できない — それは賭けではなく事故になる。
 */
export const EVENTS: readonly EventDef[] = [
  { id: 'shrine', optionCount: 2, minFloor: 5, weight: 4 },
  { id: 'merchant', optionCount: 3, minFloor: 2, weight: 4 },
  { id: 'cursedChest', optionCount: 2, minFloor: 5, weight: 3 },
  { id: 'healingSpring', optionCount: 2, minFloor: 1, weight: 4 },
  { id: 'strangeAltar', optionCount: 2, minFloor: 4, weight: 2 },
  { id: 'hiddenRoom', optionCount: 2, minFloor: 2, weight: 3 },
  // Warden が守る前提のイベントなので、Warden の出現階（7）に合わせる。
  // ここがずれていると spawnGuardian が要求を無視して別の敵を出すことになる。
  { id: 'treasury', optionCount: 2, minFloor: 7, weight: 2 },
];

const BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

export function eventDef(id: EventId): EventDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`未知のイベント: ${id}`);
  return def;
}

export function eventsAt(floor: number): readonly EventDef[] {
  const candidates = EVENTS.filter((e) => e.minFloor <= floor);
  return candidates.length > 0 ? candidates : EVENTS.slice(0, 1);
}
