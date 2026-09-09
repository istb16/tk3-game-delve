/**
 * seeded 乱数。Math.random() を直接使わないのは、同じシードで同じダンジョンを
 * 再現できることがバグ調査の生命線だから。
 */

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [min, max) の整数 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** 破壊的にシャッフルして同じ配列を返す */
  shuffle<T>(items: T[]): T[];
  /** salt から派生した独立な RNG。フロアごとの生成に使う。 */
  fork(salt: number): Rng;
  readonly seed: number;
}

/** mulberry32 - 短く、速く、十分な品質。 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max <= min) return min;
    return min + Math.floor(next() * (max - min));
  };

  return {
    seed,
    next,
    int,
    pick<T>(items: readonly T[]): T {
      const value = items[int(0, items.length)];
      if (value === undefined) throw new Error('rng.pick(): empty array');
      return value;
    },
    chance(p: number): boolean {
      return next() < p;
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(0, i + 1);
        const a = items[i] as T;
        const b = items[j] as T;
        items[i] = b;
        items[j] = a;
      }
      return items;
    },
    fork(salt: number): Rng {
      return createRng((Math.imul(seed ^ salt, 0x9e3779b1) ^ (salt << 16)) >>> 0);
    },
  };
}

/** 新しい Run 用のシード。ここだけは真の乱数でよい。 */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
