import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/core/types';
import { EQUIPMENT, EQUIPMENT_POOL, compareEquipment, toEquipment } from '../src/data/equipment';
import { createGame } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { pickupAt } from '../src/game/loot';
import { equip } from '../src/game/progression';

function gear(id: string) {
  const def = EQUIPMENT.find((e) => e.id === id);
  if (!def) throw new Error(`装備が見つからない: ${id}`);
  return toEquipment(def);
}

function drop(state: ReturnType<typeof createGame>, id: string): Entity {
  const entity: Entity = {
    id: `drop-${id}`,
    kind: 'equipment',
    pos: { ...state.player.pos },
    payload: { type: 'equipment', equipment: gear(id), declinedAgainst: null },
  };
  state.entities = [entity];
  return entity;
}

describe('装備の比較', () => {
  it('空きスロットには必ず装備できる', () => {
    expect(compareEquipment(gear('rustyDagger'), null)).toBe('better');
  });

  it('全項目で勝っていれば better、劣っていれば worse', () => {
    expect(compareEquipment(gear('ironSword'), gear('rustyDagger'))).toBe('better');
    expect(compareEquipment(gear('rustyDagger'), gear('ironSword'))).toBe('worse');
  });

  it('同じ装備は worse 扱い（持ち替える意味がないので尋ねない）', () => {
    expect(compareEquipment(gear('ironSword'), gear('ironSword'))).toBe('worse');
  });

  it('得も損もある組み合わせは sidegrade', () => {
    // 攻撃力は低いが吸収が付く
    expect(compareEquipment(gear('vampireFang'), gear('ironSword'))).toBe('sidegrade');
    // 防御は低いが回避が付く
    expect(compareEquipment(gear('shadowCloak'), gear('chainMail'))).toBe('sidegrade');
  });

  it('どの指輪も互いに上位互換にならない（1つが他を締め出さない）', () => {
    const rings = EQUIPMENT_POOL.filter((e) => e.slot === 'ring').map(toEquipment);
    expect(rings.length).toBe(4);

    for (const a of rings) {
      for (const b of rings) {
        if (a.id === b.id) continue;
        expect(compareEquipment(a, b), `${a.id} vs ${b.id}`).toBe('sidegrade');
      }
    }
  });

  it('どのスロットにも「これを拾えば以降すべて拒否される」装備が存在しない', () => {
    for (const slot of ['weapon', 'armor', 'ring'] as const) {
      const items = EQUIPMENT_POOL.filter((e) => e.slot === slot).map(toEquipment);
      for (const held of items) {
        const reachable = items.filter(
          (candidate) => candidate.id !== held.id && compareEquipment(candidate, held) !== 'worse',
        );
        expect(
          reachable.length,
          `${held.id} を装備すると ${slot} の他の装備が全部拒否される`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('装備を踏んだときの挙動', () => {
  it('上位互換は自動で装備し、外した装備は床に残る', () => {
    const state = createGame(1);
    equip(state.player, gear('rustyDagger'));
    drop(state, 'ironSword');

    pickupAt(state, state.player.pos);

    expect(state.phase).toBe('playing');
    expect(state.pendingChoices.length).toBe(0);
    expect(state.player.equipment.weapon?.id).toBe('ironSword');
    const left = state.entities[0];
    expect(left?.payload.type).toBe('equipment');
    if (left?.payload.type === 'equipment') expect(left.payload.equipment.id).toBe('rustyDagger');
  });

  it('下位互換は尋ねずに床へ残す', () => {
    const state = createGame(2);
    equip(state.player, gear('ironSword'));
    drop(state, 'rustyDagger');

    pickupAt(state, state.player.pos);

    expect(state.pendingChoices.length).toBe(0);
    expect(state.player.equipment.weapon?.id).toBe('ironSword');
    expect(state.entities.length).toBe(1);
  });

  it('トレードオフは選択待ちになり、持ち替えを選べる', () => {
    const state = createGame(3);
    equip(state.player, gear('ironSword'));
    drop(state, 'vampireFang');

    pickupAt(state, state.player.pos);
    expect(state.pendingChoices.length).toBe(1);

    takeTurn(state, { type: 'wait' });
    expect(state.phase).toBe('choosing');

    takeTurn(state, { type: 'choose', index: 0 }); // 持ち替える
    expect(state.phase).toBe('playing');
    expect(state.player.equipment.weapon?.id).toBe('vampireFang');
    expect(state.player.lifesteal).toBeGreaterThan(0);

    // 外した Iron Sword が床に残っている
    const left = state.entities[0];
    expect(left?.payload.type).toBe('equipment');
    if (left?.payload.type === 'equipment') expect(left.payload.equipment.id).toBe('ironSword');
  });

  it('今のままを選ぶと装備は変わらず、同じ比較を二度尋ねない', () => {
    const state = createGame(4);
    equip(state.player, gear('ironSword'));
    drop(state, 'vampireFang');

    pickupAt(state, state.player.pos);
    takeTurn(state, { type: 'wait' });
    takeTurn(state, { type: 'choose', index: 1 }); // 今のまま

    expect(state.player.equipment.weapon?.id).toBe('ironSword');
    expect(state.entities.length).toBe(1);

    // 踏み直しても尋ねてこない
    pickupAt(state, state.player.pos);
    expect(state.pendingChoices.length).toBe(0);
  });

  it('装備が変われば、断った組み合わせでももう一度尋ねる', () => {
    const state = createGame(5);
    equip(state.player, gear('ironSword'));
    drop(state, 'vampireFang');

    pickupAt(state, state.player.pos);
    takeTurn(state, { type: 'wait' });
    takeTurn(state, { type: 'choose', index: 1 }); // 今のまま

    // 別の武器に持ち替えると、判断の前提が変わる
    equip(state.player, gear('assassinKris'));
    pickupAt(state, state.player.pos);

    expect(state.pendingChoices.length).toBe(1);
  });

  it('選択待ちは範囲外の入力で閉じない', () => {
    const state = createGame(6);
    equip(state.player, gear('ironSword'));
    drop(state, 'vampireFang');

    pickupAt(state, state.player.pos);
    takeTurn(state, { type: 'wait' });
    takeTurn(state, { type: 'choose', index: 5 });

    expect(state.phase).toBe('choosing');
    expect(state.pendingChoices.length).toBe(1);
  });
});
