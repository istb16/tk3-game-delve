import { describe, expect, it } from 'vitest';
import type { Entity, EventId, GameState } from '../src/core/types';
import { SHRINE_COST } from '../src/core/constants';
import { EVENTS } from '../src/data/events';
import { createGame } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { pickupAt, useItem } from '../src/game/loot';

function placeEvent(state: GameState, eventId: EventId): Entity {
  const entity: Entity = {
    id: `ev-${eventId}`,
    kind: 'event',
    pos: { ...state.player.pos },
    payload: { type: 'event', eventId },
  };
  state.entities = [entity];
  return entity;
}

/** イベントを踏んで、指定の選択肢を選ぶところまで進める。 */
function resolve(state: GameState, eventId: EventId, index: number): void {
  placeEvent(state, eventId);
  pickupAt(state, state.player.pos);
  takeTurn(state, { type: 'wait' });
  expect(state.phase).toBe('choosing');
  takeTurn(state, { type: 'choose', index });
}

const ALL: readonly EventId[] = EVENTS.map((e) => e.id);

describe('ランダムイベント', () => {
  it('踏んだだけでは効果が起きず、選択待ちになる', () => {
    for (const id of ALL) {
      const state = createGame(1);
      const before = JSON.stringify(state.player);
      placeEvent(state, id);
      pickupAt(state, state.player.pos);

      expect(state.pendingChoices.length, `${id} が選択待ちにならない`).toBe(1);
      expect(JSON.stringify(state.player), `${id} が踏んだ時点で効果を出している`).toBe(before);
    }
  });

  it('立ち去ればプレイヤーの状態は変わらない', () => {
    for (const id of ALL) {
      const state = createGame(2);
      state.player.gold = 500;
      const def = EVENTS.find((e) => e.id === id);
      const before = JSON.stringify(state.player);

      resolve(state, id, (def?.optionCount ?? 2) - 1);

      expect(JSON.stringify(state.player), `${id} で立ち去ったのに状態が変わった`).toBe(before);
      expect(state.phase).toBe('playing');
    }
  });

  it('どの選択肢を選んでもイベントのマスは消える（賭け直せない）', () => {
    for (const id of ALL) {
      for (const index of [0, 1]) {
        const state = createGame(3);
        state.player.gold = 500;
        placeEvent(state, id);
        pickupAt(state, state.player.pos);
        takeTurn(state, { type: 'wait' });
        takeTurn(state, { type: 'choose', index });

        expect(
          state.entities.some((e) => e.payload.type === 'event'),
          `${id} の選択肢 ${index} でマスが残っている`,
        ).toBe(false);
      }
    }
  });

  it('範囲外の選択では閉じない', () => {
    const state = createGame(4);
    placeEvent(state, 'healingSpring');
    pickupAt(state, state.player.pos);
    takeTurn(state, { type: 'wait' });

    takeTurn(state, { type: 'choose', index: 9 });
    expect(state.phase).toBe('choosing');
    expect(state.pendingChoices.length).toBe(1);
  });

  it('祭壇はゴールドを払い、攻撃力と引き換えに最大HPを削る', () => {
    const state = createGame(5);
    state.player.gold = SHRINE_COST;
    const attackBefore = state.player.attack;
    const maxHpBefore = state.player.maxHp;

    resolve(state, 'shrine', 0);

    expect(state.player.gold).toBe(0);
    expect(state.player.attack).toBeGreaterThan(attackBefore);
    expect(state.player.maxHp).toBeLessThan(maxHpBefore);
  });

  it('祭壇の効果はレベルアップで消えない（bonuses が再計算に載る）', async () => {
    const state = createGame(6);
    state.player.gold = SHRINE_COST;
    resolve(state, 'shrine', 0);
    const maxHpAfterCurse = state.player.maxHp;

    // レベルアップすると recalcStats がレベルから引き直す
    takeTurn(state, { type: 'wait' });
    const { gainExp } = await import('../src/game/player');
    gainExp(state, 1000);

    // 祝福も呪いも残っているか（素の伸びと比べて -10 のままか）
    const plain = createGame(7);
    const { gainExp: gainExp2 } = await import('../src/game/player');
    gainExp2(plain, 1000);
    while (plain.player.level > state.player.level) gainExp2(state, 1000);
    while (state.player.level > plain.player.level) gainExp2(plain, 1000);

    expect(state.player.maxHp).toBe(plain.player.maxHp - 10);
    expect(state.player.attack).toBeGreaterThan(plain.player.attack);
    expect(maxHpAfterCurse).toBeLessThan(plain.player.maxHp);
  });

  it('ゴールドが足りなければ祭壇は何も起こさない', () => {
    const state = createGame(8);
    state.player.gold = SHRINE_COST - 1;
    const attackBefore = state.player.attack;

    resolve(state, 'shrine', 0);

    expect(state.player.gold).toBe(SHRINE_COST - 1);
    expect(state.player.attack).toBe(attackBefore);
    expect(state.log.some((e) => e.key === 'log.merchantPoor')).toBe(true);
  });

  it('回復の泉は全回復と引き換えに敵を増やす', () => {
    const state = createGame(9);
    state.player.hp = 1;
    const enemiesBefore = state.enemies.length;

    resolve(state, 'healingSpring', 0);

    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.enemies.length).toBeGreaterThan(enemiesBefore);
  });

  it('宝物庫はゴールドと引き換えに番人を起こす', () => {
    const state = createGame(10);
    state.floor = 8;
    const goldBefore = state.player.gold;
    const enemiesBefore = state.enemies.length;

    resolve(state, 'treasury', 0);

    expect(state.player.gold).toBeGreaterThan(goldBefore);
    expect(state.enemies.length).toBeGreaterThan(enemiesBefore);
  });

  it('湧いた敵はプレイヤーの隣には出ない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed * 13);
      state.player.hp = 1;
      resolve(state, 'healingSpring', 0);

      for (const enemy of state.enemies) {
        const distance =
          Math.abs(enemy.pos.x - state.player.pos.x) + Math.abs(enemy.pos.y - state.player.pos.y);
        expect(distance, `seed=${seed} 湧いた敵が隣接している`).toBeGreaterThan(1);
      }
    }
  });
});

describe('巻物と鍵', () => {
  it('巻物は必ず何かを起こし、消費される', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed * 7);
      state.player.inventory[0] = { itemId: 'scroll', count: 1 };

      expect(useItem(state, 0), `seed=${seed} 巻物が不発`).toBe(true);
      expect(state.player.inventory[0]).toBeNull();
      expect(state.log.some((e) => e.key === 'log.useScroll')).toBe(true);
    }
  });

  it('鍵なしでは施錠された宝箱を開けられず、宝箱は残る', () => {
    const state = createGame(11);
    state.entities = [
      { id: 'c', kind: 'chest', pos: { ...state.player.pos }, payload: { type: 'chest', locked: true } },
    ];
    pickupAt(state, state.player.pos);

    expect(state.stats.chestsOpened).toBe(0);
    expect(state.entities.some((e) => e.payload.type === 'chest')).toBe(true);
    expect(state.log.some((e) => e.key === 'log.needKey')).toBe(true);
  });

  it('鍵があれば開き、鍵は消費される', () => {
    const state = createGame(12);
    state.player.inventory[0] = { itemId: 'key', count: 1 };
    state.entities = [
      { id: 'c', kind: 'chest', pos: { ...state.player.pos }, payload: { type: 'chest', locked: true } },
    ];
    pickupAt(state, state.player.pos);

    expect(state.stats.chestsOpened).toBe(1);
    expect(state.player.inventory[0]).toBeNull();
    expect(state.entities.some((e) => e.payload.type === 'chest')).toBe(false);
  });

  it('施錠された宝箱の中身はレア以上の装備', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed * 3);
      state.floor = 9;
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

      const equipped = state.player.equipment.weapon ?? state.player.equipment.armor ?? state.player.equipment.ring;
      const left = state.entities.find((e) => e.payload.type === 'equipment');
      const gained = equipped ?? (left?.payload.type === 'equipment' ? left.payload.equipment : null);
      expect(gained, `seed=${seed} 装備が出ていない`).not.toBeNull();
      expect(gained?.rarity, `seed=${seed} common が出た`).not.toBe('common');
    }
  });
});
