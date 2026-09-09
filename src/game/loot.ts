import type { Dungeon, Entity, GameState, ItemId, Player, Vec2 } from '../core/types';
import type { Rng } from '../core/rng';
import {
  INVENTORY_SIZE,
  POTION_HEAL,
  SPAWN_MIN_DISTANCE,
  potionsPerFloor,
} from '../core/constants';
import { addLog } from '../core/log';
import { UNREACHABLE, bfsDistances, tileIndex } from './dungeon';

let nextEntityId = 0;

// --- 配置 --------------------------------------------------------------------

/**
 * 床に落ちている物を配置する。
 *
 * 敵と同じく、到達可能マスかつ start から離れた場所にだけ置く。
 * 敵の上には置かない（拾うために必ず戦わせるのは判断ではなく強制になる）。
 */
export function spawnEntities(
  rng: Rng,
  dungeon: Dungeon,
  floor: number,
  occupied: readonly Vec2[],
): Entity[] {
  const dist = bfsDistances(dungeon, dungeon.start);
  const taken = new Set(occupied.map((p) => tileIndex(dungeon, p.x, p.y)));

  const candidates: Vec2[] = [];
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const i = tileIndex(dungeon, x, y);
      const d = dist[i] ?? UNREACHABLE;
      if (d < SPAWN_MIN_DISTANCE) continue;
      if (taken.has(i)) continue;
      if (x === dungeon.stairs.x && y === dungeon.stairs.y) continue;
      candidates.push({ x, y });
    }
  }
  rng.shuffle(candidates);

  const entities: Entity[] = [];
  const count = potionsPerFloor(floor);
  for (let i = 0; i < count && i < candidates.length; i++) {
    entities.push({
      id: `entity-${nextEntityId++}`,
      kind: 'item',
      pos: { ...(candidates[i] as Vec2) },
      payload: { type: 'item', itemId: 'potion', count: 1 },
    });
  }
  return entities;
}

// --- 拾得 --------------------------------------------------------------------

/** プレイヤーの足元にある物を拾う。移動のたびに呼ばれる。 */
export function pickupAt(state: GameState, pos: Vec2): void {
  const index = state.entities.findIndex((e) => e.pos.x === pos.x && e.pos.y === pos.y);
  if (index === -1) return;

  const entity = state.entities[index] as Entity;
  const { itemId, count } = entity.payload;

  if (!addToInventory(state.player, itemId, count)) {
    // 満杯なら床に残す。勝手に消えると「拾えなかった」ことに気づけない。
    addLog(state.log, 'log.inventoryFull', {}, 'bad');
    return;
  }

  state.entities.splice(index, 1);
  addLog(state.log, 'log.pickup', { item: itemId, count }, 'gold');
}

/** @returns 入れられたか（満杯なら false） */
function addToInventory(player: Player, itemId: ItemId, count: number): boolean {
  const existing = player.inventory.find((slot) => slot?.itemId === itemId);
  if (existing) {
    existing.count += count;
    return true;
  }
  const empty = player.inventory.indexOf(null);
  if (empty === -1) return false;
  player.inventory[empty] = { itemId, count };
  return true;
}

export function createInventory(): (null)[] {
  return new Array<null>(INVENTORY_SIZE).fill(null);
}

// --- 使用 --------------------------------------------------------------------

/** @returns ターンを消費したか */
export function useItem(state: GameState, slot: number): boolean {
  const stack = state.player.inventory[slot];
  if (!stack || stack.count <= 0) {
    // 空きスロットを押しただけでターンを失うのは理不尽なので消費しない
    addLog(state.log, 'log.emptySlot', { slot: slot + 1 }, 'info');
    return false;
  }

  const healed = healPlayer(state, POTION_HEAL);
  addLog(state.log, 'log.usePotion', { healed }, 'good');

  stack.count -= 1;
  if (stack.count <= 0) state.player.inventory[slot] = null;
  return true;
}

/** 最大HPに対する割合で回復し、実際に回復した量を返す。 */
export function healPlayer(state: GameState, ratio: number): number {
  const player = state.player;
  const amount = Math.floor(player.maxHp * ratio);
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  return player.hp - before;
}
