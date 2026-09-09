import { describe, expect, it } from 'vitest';
import { SPAWN_MIN_DISTANCE } from '../src/core/constants';
import { UNREACHABLE, bfsDistances, isWalkable, tileIndex } from '../src/game/dungeon';
import { createGame, descend } from '../src/game/state';
import { potionsPerFloorForTest } from './helpers/expectations';

describe('敵とエンティティの配置', () => {
  it('30階まで降りても配置の不変条件が崩れない', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed * 101);

      for (let step = 0; step < 30; step++) {
        const dist = bfsDistances(state.dungeon, state.dungeon.start);
        const occupied = new Set<number>();

        for (const enemy of state.enemies) {
          const i = tileIndex(state.dungeon, enemy.pos.x, enemy.pos.y);
          expect(isWalkable(state.dungeon, enemy.pos.x, enemy.pos.y)).toBe(true);
          expect(dist[i] ?? UNREACHABLE).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE);
          expect(occupied.has(i), '敵が重なっている').toBe(false);
          occupied.add(i);
        }

        for (const entity of state.entities) {
          const i = tileIndex(state.dungeon, entity.pos.x, entity.pos.y);
          expect(isWalkable(state.dungeon, entity.pos.x, entity.pos.y)).toBe(true);
          expect(dist[i] ?? UNREACHABLE).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE);
          expect(occupied.has(i), '生成時に敵と重なっている').toBe(false);
          occupied.add(i);
        }

        // 階段の上には何も置かない（降りる前に必ず拾わされることになる）
        for (const entity of state.entities) {
          expect(entity.pos).not.toEqual(state.dungeon.stairs);
        }

        descend(state);
      }
    }
  });

  it('ポーションは階層に応じた本数だけ置かれる', () => {
    for (const floor of [1, 5, 9, 10, 20]) {
      const state = createGame(12345);
      while (state.floor < floor) descend(state);
      const potions = state.entities.filter(
        (e) => e.payload.type === 'item' && e.payload.itemId === 'potion',
      ).length;
      expect(potions, `floor=${floor}`).toBe(potionsPerFloorForTest(floor));
    }
  });
});
