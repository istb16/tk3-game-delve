import type { Dungeon, Entity, GameState, ItemId, ItemStack, Player, Vec2 } from '../core/types';
import type { Rng } from '../core/rng';
import {
  INVENTORY_SIZE,
  MAX_STACK,
  POTION_HEAL,
  SPAWN_MIN_DISTANCE,
  potionsPerFloor,
} from '../core/constants';
import { addLog, addLogOnce } from '../core/log';
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

  const accepted = addToInventory(state.player, itemId, count);
  if (accepted === 0) {
    // 満杯なら床に残す。勝手に消えると「拾えなかった」ことに気づけない。
    // 同じマスに立ち続けても繰り返し積まないよう addLogOnce を使う。
    addLogOnce(state.log, 'log.inventoryFull', {}, 'bad');
    return;
  }

  if (accepted < count) {
    // 一部だけ入った分は床に残す
    entity.payload.count = count - accepted;
  } else {
    state.entities.splice(index, 1);
  }
  addLog(state.log, 'log.pickup', { item: itemId, count: accepted }, 'gold');
}

/**
 * 入る分だけ入れて、実際に受け取った個数を返す。
 *
 * 1スロットの上限を超えたら次のスロットへ送る。上限がないと同種のアイテムが
 * 1スロットに無限に積み上がり、スロット数が持ち運び量の制限として機能しない。
 */
function addToInventory(player: Player, itemId: ItemId, count: number): number {
  let remaining = count;

  // まず既存のスタックの空き分に詰める
  for (const slot of player.inventory) {
    if (remaining === 0) break;
    if (slot?.itemId !== itemId) continue;
    const room = MAX_STACK - slot.count;
    if (room <= 0) continue;
    const put = Math.min(room, remaining);
    slot.count += put;
    remaining -= put;
  }

  // 残りは空きスロットへ
  for (let i = 0; i < player.inventory.length && remaining > 0; i++) {
    if (player.inventory[i] !== null) continue;
    const put = Math.min(MAX_STACK, remaining);
    player.inventory[i] = { itemId, count: put };
    remaining -= put;
  }

  return count - remaining;
}

export function createInventory(): (ItemStack | null)[] {
  return new Array<ItemStack | null>(INVENTORY_SIZE).fill(null);
}

// --- 使用 --------------------------------------------------------------------

/** @returns ターンを消費したか */
export function useItem(state: GameState, slot: number): boolean {
  const stack = state.player.inventory[slot];
  if (!stack || stack.count <= 0) {
    // 空きスロットを押しただけでターンを失うのは理不尽なので消費しない
    addLogOnce(state.log, 'log.emptySlot', { slot: slot + 1 }, 'info');
    return false;
  }

  if (!applyItem(state, stack.itemId)) return false;

  stack.count -= 1;
  if (stack.count <= 0) state.player.inventory[slot] = null;
  return true;
}

/**
 * アイテムの効果を適用する。
 *
 * @returns 効果があったか。false なら**アイテムもターンも消費しない**。
 *   満タンでポーションを誤爆すると、1本失うだけでなく敵に1ターン与えることになる。
 *   回復が最も乏しい資源である以上、その誤爆は取り返しがつかない。
 */
function applyItem(state: GameState, itemId: ItemId): boolean {
  switch (itemId) {
    case 'potion': {
      if (state.player.hp >= state.player.maxHp) {
        addLogOnce(state.log, 'log.alreadyFull', {}, 'info');
        return false;
      }
      const healed = healPlayer(state, POTION_HEAL);
      addLog(state.log, 'log.usePotion', { healed }, 'good');
      return true;
    }
    default:
      // 新しいアイテムを ItemId に足したらここで型エラーになる。
      // 分岐を書き忘れたまま「飲むと回復する」挙動を引き継がせないための番人。
      return assertNever(itemId);
  }
}

function assertNever(value: never): never {
  throw new Error(`未処理のアイテム: ${String(value)}`);
}

/** 最大HPに対する割合で回復し、実際に回復した量を返す。 */
export function healPlayer(state: GameState, ratio: number): number {
  const player = state.player;
  const amount = Math.floor(player.maxHp * ratio);
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  return player.hp - before;
}
