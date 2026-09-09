import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { GRID_SIZE, SPAWN_MIN_DISTANCE } from '../src/core/constants';
import {
  UNREACHABLE,
  bfsDistances,
  generateDungeon,
  tileAt,
  tileIndex,
} from '../src/game/dungeon';

/** 不変条件の一覧は docs/08 §8.3 が正本。 */

const SEEDS = 200;
const FLOORS = [1, 2, 5, 10, 25, 50, 100];

describe('ダンジョン生成', () => {
  it('階段が start から必ず到達可能で、十分に遠い', () => {
    const minSpan = Math.floor((GRID_SIZE + GRID_SIZE) / 4);
    let worst = Infinity;

    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const floor of FLOORS) {
        const d = generateDungeon(createRng(seed).fork(floor), floor);
        const dist = bfsDistances(d, d.start);
        const span = dist[tileIndex(d, d.stairs.x, d.stairs.y)] ?? UNREACHABLE;
        expect(span, `seed=${seed} floor=${floor}`).not.toBe(UNREACHABLE);
        worst = Math.min(worst, span);
      }
    }
    expect(worst).toBeGreaterThanOrEqual(minSpan);
  });

  it('外周がすべて壁', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const d = generateDungeon(createRng(seed).fork(7), 7);
      for (let i = 0; i < d.width; i++) {
        expect(tileAt(d, i, 0)).toBe('wall');
        expect(tileAt(d, i, d.height - 1)).toBe('wall');
        expect(tileAt(d, 0, i)).toBe('wall');
        expect(tileAt(d, d.width - 1, i)).toBe('wall');
      }
    }
  });

  it('同じシード・同じ階層なら完全に同じフロアになる', () => {
    for (const seed of [1, 42, 9999]) {
      for (const floor of FLOORS) {
        const a = generateDungeon(createRng(seed).fork(floor), floor);
        const b = generateDungeon(createRng(seed).fork(floor), floor);
        expect(a.tiles).toEqual(b.tiles);
        expect(a.start).toEqual(b.start);
        expect(a.stairs).toEqual(b.stairs);
      }
    }
  });

  it('範囲外は壁として扱われる（境界チェックを tileAt に集約している）', () => {
    const d = generateDungeon(createRng(1).fork(1), 1);
    expect(tileAt(d, -1, 5)).toBe('wall');
    expect(tileAt(d, 5, -1)).toBe('wall');
    expect(tileAt(d, d.width, 5)).toBe('wall');
    expect(tileAt(d, 5, d.height)).toBe('wall');
  });

  it('SPAWN_MIN_DISTANCE 以上離れた到達可能マスが必ず存在する', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const d = generateDungeon(createRng(seed).fork(1), 1);
      const dist = bfsDistances(d, d.start);
      const far = dist.filter((v) => v >= SPAWN_MIN_DISTANCE).length;
      expect(far, `seed=${seed}`).toBeGreaterThan(0);
    }
  });
});
