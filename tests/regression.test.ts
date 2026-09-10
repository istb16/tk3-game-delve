import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/core/types';
import { ENEMIES } from '../src/data/enemies';
import { EVENTS } from '../src/data/events';
import { FIRST_RARE_FLOOR } from '../src/data/equipment';
import { createGame, descend } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { pickupAt } from '../src/game/loot';
import { spawnGuardian } from '../src/game/enemy';

/**
 * コードレビューで見つかった不具合の退行テスト。
 * どれも「一度は本番に入った」ものなので、消さずに残す。
 */

describe('イベントの二重発火', () => {
  it('同じマスを踏み直しても選択は1つしか積まれない', () => {
    const state = createGame(1);
    const entity: Entity = {
      id: 'ev',
      kind: 'event',
      pos: { ...state.player.pos },
      payload: { type: 'event', eventId: 'healingSpring' },
    };
    state.entities = [entity];

    // Swift Step でターンを消費せず踏み直した状況
    pickupAt(state, state.player.pos);
    pickupAt(state, state.player.pos);
    pickupAt(state, state.player.pos);

    expect(state.pendingChoices.length, '同じイベントが複数回積まれている').toBe(1);
  });

  it('二重に積まれないので効果も1回しか起きない', () => {
    const state = createGame(2);
    state.player.hp = 1;
    state.entities = [
      {
        id: 'ev',
        kind: 'event',
        pos: { ...state.player.pos },
        payload: { type: 'event', eventId: 'healingSpring' },
      },
    ];
    const enemiesBefore = state.enemies.length;

    pickupAt(state, state.player.pos);
    pickupAt(state, state.player.pos);
    takeTurn(state, { type: 'wait' });
    takeTurn(state, { type: 'choose', index: 0 });

    expect(state.phase, 'まだ選択が残っている').toBe('playing');
    // 泉は敵を2体増やす。二重発火なら4体増える。
    expect(state.enemies.length - enemiesBefore).toBeLessThanOrEqual(2);
  });
});

describe('イベントで湧く敵も出現階を守る', () => {
  it('指定した種類が出現階に達していなければ、その種類は出さない', () => {
    const warden = ENEMIES.find((e) => e.kind === 'warden');
    expect(warden).toBeDefined();
    const tooShallow = (warden?.minFloor ?? 7) - 1;

    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed * 19);
      state.floor = tooShallow;
      spawnGuardian(state, 3, 'warden');

      expect(
        state.enemies.some((e) => e.kind === 'warden'),
        `${tooShallow} 階に Warden が湧いた`,
      ).toBe(false);
    }
  });

  it('出現階に達していれば指定どおり出る', () => {
    const warden = ENEMIES.find((e) => e.kind === 'warden');
    const floor = warden?.minFloor ?? 7;
    const state = createGame(3);
    state.floor = floor;
    spawnGuardian(state, 1, 'warden');
    expect(state.enemies.some((e) => e.kind === 'warden')).toBe(true);
  });

  it('宝物庫の出現階が Warden の出現階以上になっている', () => {
    const treasury = EVENTS.find((e) => e.id === 'treasury');
    const warden = ENEMIES.find((e) => e.kind === 'warden');
    expect(treasury?.minFloor).toBeGreaterThanOrEqual(warden?.minFloor ?? 7);
  });

  it('イベントで湧いた敵も生成時の出現階を守る', () => {
    const limits = new Map(ENEMIES.map((e) => [e.kind, e.minFloor]));
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed * 23);
      for (let i = 0; i < 8; i++) {
        spawnGuardian(state, 2);
        for (const enemy of state.enemies) {
          expect(state.floor).toBeGreaterThanOrEqual(limits.get(enemy.kind) ?? 1);
        }
        descend(state);
      }
    }
  });
});

describe('施錠された宝箱の約束', () => {
  it('レア以上が存在しない階では宝箱を施錠しない', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = createGame(seed * 11);
      while (state.floor < FIRST_RARE_FLOOR) {
        for (const entity of state.entities) {
          if (entity.payload.type === 'chest') {
            expect(
              entity.payload.locked,
              `${state.floor} 階（レアが存在しない）で施錠された宝箱が生成された`,
            ).toBe(false);
          }
        }
        descend(state);
      }
    }
  });

  it('施錠された宝箱の中身は必ずレア以上', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const floor of [FIRST_RARE_FLOOR, 8, 15]) {
        const state = createGame(seed * 5);
        state.floor = floor;
        state.player.inventory[0] = { itemId: 'key', count: 1 };
        state.entities = [
          {
            id: 'c',
            kind: 'chest',
            pos: { ...state.player.pos },
            payload: { type: 'chest', locked: true },
          },
        ];
        pickupAt(state, state.player.pos);

        const worn =
          state.player.equipment.weapon ??
          state.player.equipment.armor ??
          state.player.equipment.ring;
        const left = state.entities.find((e) => e.payload.type === 'equipment');
        const gained = worn ?? (left?.payload.type === 'equipment' ? left.payload.equipment : null);

        expect(gained, `seed=${seed} floor=${floor} 装備が出ていない`).not.toBeNull();
        expect(gained?.rarity, `seed=${seed} floor=${floor} common が出た`).not.toBe('common');
      }
    }
  });

  it('鍵は使い道がない階には落ちていない', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed * 7);
      while (state.floor < FIRST_RARE_FLOOR - 1) {
        for (const entity of state.entities) {
          if (entity.payload.type === 'item') {
            expect(
              entity.payload.itemId,
              `${state.floor} 階に使い道のない鍵が落ちている`,
            ).not.toBe('key');
          }
        }
        descend(state);
      }
    }
  });
});
