import { describe, expect, it } from 'vitest';
import type { Entity, GameState, ItemId } from '../src/core/types';
import { MAX_STACK, POTION_HEAL } from '../src/core/constants';
import { createGame } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { pickupAt, useItem } from '../src/game/loot';
import { equip } from '../src/game/progression';
import { EQUIPMENT, toEquipment } from '../src/data/equipment';

function itemAt(state: GameState, itemId: ItemId): Entity {
  return {
    id: `test-${itemId}-${state.entities.length}`,
    kind: 'item',
    pos: { ...state.player.pos },
    payload: { type: 'item', itemId, count: 1 },
  };
}

function equipmentById(id: string) {
  const def = EQUIPMENT.find((e) => e.id === id);
  if (!def) throw new Error(`装備が見つからない: ${id}`);
  return toEquipment(def);
}

function enemyPositions(state: GameState): string {
  return JSON.stringify(state.enemies.map((e) => [e.pos.x, e.pos.y]));
}

describe('インベントリ', () => {
  it('1スロットの上限を超えたら次のスロットへ送る', () => {
    const state = createGame(1);
    state.entities = [];
    for (let i = 0; i < MAX_STACK + 1; i++) {
      state.entities.push(itemAt(state, 'potion'));
      pickupAt(state, state.player.pos);
    }
    const used = state.player.inventory.filter((s) => s !== null);
    expect(used.length).toBe(2);
    expect(used[0]?.count).toBe(MAX_STACK);
    expect(used[1]?.count).toBe(1);
  });

  it('全スロットが埋まったら床に残り、満杯のログが出る', () => {
    const state = createGame(2);
    state.entities = [];
    const capacity = state.player.inventory.length * MAX_STACK;

    for (let i = 0; i < capacity + 3; i++) {
      state.entities.push(itemAt(state, 'potion'));
      pickupAt(state, state.player.pos);
    }
    const total = state.player.inventory.reduce((n, s) => n + (s?.count ?? 0), 0);
    expect(total).toBe(capacity);
    expect(state.entities.length).toBe(3);
    expect(state.log.some((e) => e.key === 'log.inventoryFull')).toBe(true);
  });
});

describe('アイテムの使用', () => {
  it('空スロットはターンを消費しない', () => {
    const state = createGame(3);
    const before = enemyPositions(state);
    expect(useItem(state, 7)).toBe(false);
    takeTurn(state, { type: 'useItem', slot: 7 });
    expect(enemyPositions(state)).toBe(before);
  });

  it('満タンのポーションはアイテムもターンも消費しない', () => {
    const state = createGame(4);
    state.player.inventory[0] = { itemId: 'potion', count: 2 };
    state.player.hp = state.player.maxHp;
    const before = enemyPositions(state);

    expect(useItem(state, 0)).toBe(false);
    expect(state.player.inventory[0]?.count).toBe(2);

    takeTurn(state, { type: 'useItem', slot: 0 });
    expect(enemyPositions(state)).toBe(before);
  });

  it('ポーションは最大HPの割合で回復し、上限を超えない', () => {
    const state = createGame(5);
    state.player.inventory[0] = { itemId: 'potion', count: 1 };
    state.player.hp = 1;
    expect(useItem(state, 0)).toBe(true);
    expect(state.player.hp).toBe(1 + Math.floor(state.player.maxHp * POTION_HEAL));
    expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
  });

  it('爆弾で倒した敵からも経験値が入り、外周の壁は壊れない', () => {
    const state = createGame(6);
    state.player.inventory[0] = { itemId: 'bomb', count: 1 };
    state.enemies = [
      {
        id: 'target',
        kind: 'rat',
        name: 'Rat',
        ai: 'chase',
        pos: { x: state.player.pos.x + 1, y: state.player.pos.y },
        hp: 5,
        maxHp: 5,
        attack: 1,
        defense: 0,
        speed: 1,
        exp: 7,
        gold: 3,
        steps: 0,
        hurtOnTurn: -1,
        lastDamage: 0,
        effects: [],
        evasion: 0,
        ability: null,
        revived: false,
        split: false,
      },
    ];
    const expBefore = state.player.exp;

    expect(useItem(state, 0)).toBe(true);
    expect(state.stats.kills).toBe(1);
    expect(state.player.exp > expBefore || state.pendingChoices.length > 0).toBe(true);

    for (let x = 0; x < state.dungeon.width; x++) {
      expect(state.dungeon.tiles[x]).toBe('wall');
    }
  });

  it('敵も壁もない場所での爆弾は消費しない', () => {
    const state = createGame(7);
    // 周囲がすべて床の開けた場所を作る
    state.dungeon.tiles = state.dungeon.tiles.map(() => 'floor');
    state.player.pos = { x: 7, y: 7 };
    state.enemies = [];
    state.player.inventory[0] = { itemId: 'bomb', count: 1 };

    expect(useItem(state, 0)).toBe(false);
    expect(state.player.inventory[0]?.count).toBe(1);
  });
});

describe('装備', () => {
  it('弱い装備は自動装備されず床に残る', () => {
    const state = createGame(8);
    const strong = equipmentById('assassinKris');
    const weak = equipmentById('rustyDagger');
    equip(state.player, strong);
    const attackBefore = state.player.attack;

    state.entities = [
      {
        id: 'w',
        kind: 'equipment',
        pos: { ...state.player.pos },
        payload: { type: 'equipment', equipment: weak, declinedAgainst: null },
      },
    ];
    pickupAt(state, state.player.pos);

    expect(state.player.equipment.weapon?.id).toBe('assassinKris');
    expect(state.player.attack).toBe(attackBefore);
    expect(state.entities.length).toBe(1);
  });

  it('強い装備に入れ替えると、外した装備が同じマスに残る', () => {
    const state = createGame(9);
    const weak = equipmentById('rustyDagger');
    const strong = equipmentById('assassinKris');
    equip(state.player, weak);

    state.entities = [
      {
        id: 'w',
        kind: 'equipment',
        pos: { ...state.player.pos },
        payload: { type: 'equipment', equipment: strong, declinedAgainst: null },
      },
    ];
    pickupAt(state, state.player.pos);

    expect(state.player.equipment.weapon?.id).toBe('assassinKris');
    expect(state.entities.length).toBe(1);
    const left = state.entities[0];
    expect(left?.payload.type).toBe('equipment');
    if (left?.payload.type === 'equipment') {
      expect(left.payload.equipment.id).toBe('rustyDagger');
      expect(left.pos).toEqual(state.player.pos);
    }
  });
});

describe('宝箱', () => {
  it('開けると必ず何かが手に入り、宝箱そのものは消える', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createGame(seed * 17);
      state.entities = [
        {
          id: 'c',
          kind: 'chest',
          pos: { ...state.player.pos },
          payload: { type: 'chest', locked: false },
        },
      ];
      const goldBefore = state.player.gold;
      pickupAt(state, state.player.pos);

      expect(state.stats.chestsOpened).toBe(1);
      expect(state.entities.some((e) => e.payload.type === 'chest')).toBe(false);

      const gained =
        state.player.gold > goldBefore ||
        state.player.inventory.some((s) => s !== null) ||
        state.player.equipment.weapon !== null ||
        state.player.equipment.armor !== null ||
        state.player.equipment.ring !== null ||
        state.entities.length > 0;
      expect(gained, `seed=${seed} 宝箱を開けたのに何も起きていない`).toBe(true);
    }
  });
});
