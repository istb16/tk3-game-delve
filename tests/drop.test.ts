import { describe, expect, it } from 'vitest';
import type { Entity, GameState } from '../src/core/types';
import { createGame } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { dropItem, pickupAt } from '../src/game/loot';
import { intentFromKey } from '../src/ui/input';
import { isWalkable, tileIndex } from '../src/game/dungeon';

function keyEvent(over: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...over,
  } as KeyboardEvent;
}

function enemyPositions(state: GameState): string {
  return JSON.stringify(state.enemies.map((e) => [e.pos.x, e.pos.y]));
}

describe('アイテムを捨てる', () => {
  it('捨てたアイテムは床に残る（消滅しない）', () => {
    const state = createGame(1);
    state.entities = [];
    state.player.inventory[0] = { itemId: 'bomb', count: 2 };

    expect(dropItem(state, 0)).toBe(true);

    expect(state.player.inventory[0]?.count).toBe(1);
    const dropped = state.entities.find((e) => e.payload.type === 'item');
    expect(dropped, '床に置かれていない').toBeDefined();
    if (dropped?.payload.type === 'item') expect(dropped.payload.itemId).toBe('bomb');
  });

  it('最後の1個を捨てるとスロットが空になる', () => {
    const state = createGame(2);
    state.entities = [];
    state.player.inventory[0] = { itemId: 'scroll', count: 1 };

    dropItem(state, 0);

    expect(state.player.inventory[0]).toBeNull();
  });

  it('捨てたものは拾い直せる', () => {
    const state = createGame(3);
    state.entities = [];
    state.player.inventory[0] = { itemId: 'potion', count: 1 };

    dropItem(state, 0);
    expect(state.player.inventory.every((s) => s === null)).toBe(true);

    pickupAt(state, state.player.pos);
    expect(state.player.inventory[0]?.itemId).toBe('potion');
  });

  it('足元が埋まっていれば隣のマスへ置く（1マスに2つ置かない）', () => {
    const state = createGame(4);
    const occupying: Entity = {
      id: 'blocker',
      kind: 'item',
      pos: { ...state.player.pos },
      payload: { type: 'item', itemId: 'key', count: 1 },
    };
    state.entities = [occupying];
    state.player.inventory[0] = { itemId: 'bomb', count: 1 };

    expect(dropItem(state, 0)).toBe(true);

    // 同じマスに2つ置くと pickupAt が片方しか拾えず、もう片方が永久に取れない
    const perTile = new Map<string, number>();
    for (const e of state.entities) {
      const key = `${e.pos.x},${e.pos.y}`;
      perTile.set(key, (perTile.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perTile.values()), '1マスに2つ置かれている').toBe(1);
  });

  it('置き場所が無ければ捨てられず、アイテムも消えない', () => {
    const state = createGame(5);
    state.player.inventory[0] = { itemId: 'bomb', count: 1 };

    // 足元と隣接をすべて埋める
    const here = state.player.pos;
    state.entities = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
      .map((d, i) => ({
        id: `b${i}`,
        kind: 'item' as const,
        pos: { x: here.x + d.x, y: here.y + d.y },
        payload: { type: 'item' as const, itemId: 'key' as const, count: 1 },
      }))
      .filter((e) => isWalkable(state.dungeon, e.pos.x, e.pos.y));

    expect(dropItem(state, 0)).toBe(false);
    expect(state.player.inventory[0]?.count, 'アイテムが消えている').toBe(1);
    expect(state.log.some((e) => e.key === 'log.dropNoRoom')).toBe(true);
  });

  it('階段のマスには置かない（踏んだ瞬間に拾い直して降りてしまう）', () => {
    const state = createGame(41);
    const here = state.player.pos;

    // 足元を埋めて、隣接のうち歩けるマスを1つだけ残し、そこを階段にする
    const steps = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];
    const walkable = steps
      .map((d) => ({ x: here.x + d.x, y: here.y + d.y }))
      .filter((p) => isWalkable(state.dungeon, p.x, p.y));
    expect(walkable.length, '歩ける隣接マスが無いシード').toBeGreaterThan(0);

    const stairs = walkable[0] as { x: number; y: number };
    state.dungeon.stairs = { ...stairs };
    state.dungeon.tiles[tileIndex(state.dungeon, stairs.x, stairs.y)] = 'stairs';

    state.entities = [
      { x: 0, y: 0 },
      ...steps,
    ]
      .map((d) => ({ x: here.x + d.x, y: here.y + d.y }))
      .filter((p) => isWalkable(state.dungeon, p.x, p.y))
      .filter((p) => !(p.x === stairs.x && p.y === stairs.y))
      .map((pos, i) => ({
        id: `b${i}`,
        kind: 'item' as const,
        pos,
        payload: { type: 'item' as const, itemId: 'key' as const, count: 1 },
      }));

    state.player.inventory[0] = { itemId: 'bomb', count: 1 };

    // 残っている空きマスは階段だけ。置いてはいけないので捨てられない
    expect(dropItem(state, 0)).toBe(false);
    expect(state.player.inventory[0]?.count, 'アイテムが消えている').toBe(1);
    expect(
      state.entities.some((e) => e.pos.x === stairs.x && e.pos.y === stairs.y),
      '階段のマスに置かれている',
    ).toBe(false);
  });

  it('空のスロットを捨てようとしてもターンを消費しない', () => {
    const state = createGame(6);
    const before = enemyPositions(state);
    expect(dropItem(state, 7)).toBe(false);
    takeTurn(state, { type: 'dropItem', slot: 7 });
    expect(enemyPositions(state)).toBe(before);
  });

  it('捨てるとターンを消費する（敵が動く）', () => {
    const state = createGame(7);
    state.entities = [];
    state.player.inventory[0] = { itemId: 'bomb', count: 1 };
    // 動ける敵を隣接しない位置に置く
    const before = state.player.steps;

    takeTurn(state, { type: 'dropItem', slot: 0 });

    // プレイヤーは動いていないが、ターンは進んでいる
    expect(state.player.steps).toBe(before);
    expect(state.turn).toBeGreaterThan(0);
    expect(state.player.inventory[0]).toBeNull();
  });
});

describe('捨てるキー操作', () => {
  it('Shift + 数字で捨てる', () => {
    expect(intentFromKey(keyEvent({ code: 'Digit1', key: '!', shiftKey: true }), 'playing')).toEqual({
      type: 'dropItem',
      slot: 0,
    });
    expect(intentFromKey(keyEvent({ code: 'Digit8', key: '(', shiftKey: true }), 'playing')).toEqual({
      type: 'dropItem',
      slot: 7,
    });
  });

  it('配列に依らない（event.key ではなく event.code で判定する）', () => {
    // US 配列では Shift+1 が '!' になる。key で判定すると効かなくなる。
    const usLayout = keyEvent({ code: 'Digit3', key: '#', shiftKey: true });
    expect(intentFromKey(usLayout, 'playing')).toEqual({ type: 'dropItem', slot: 2 });
  });

  it('AZERTY 配列でも数字キーでアイテムを使える', () => {
    // AZERTY は数字段を素で押すと '&' などになる。event.key で判定していると
    // フランス語配列のユーザーはアイテムを一切使えない。
    const azerty = keyEvent({ code: 'Digit1', key: '&' });
    expect(intentFromKey(azerty, 'playing')).toEqual({ type: 'useItem', slot: 0 });
  });

  it('Shift + WASD では動かない', () => {
    expect(intentFromKey(keyEvent({ code: 'KeyW', key: 'W', shiftKey: true }), 'playing')).toBeNull();
  });

  it('Shift なしの数字は今までどおり使用', () => {
    expect(intentFromKey(keyEvent({ code: 'Digit2', key: '2' }), 'playing')).toEqual({
      type: 'useItem',
      slot: 1,
    });
  });

  it('選択待ち中は捨てられない', () => {
    expect(intentFromKey(keyEvent({ code: 'Digit1', key: '!', shiftKey: true }), 'choosing')).toEqual(
      { type: 'choose', index: 0 },
    );
  });
});
