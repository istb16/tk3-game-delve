import type {
  Dungeon,
  Entity,
  EntityPayload,
  Equipment,
  GameState,
  ItemId,
  ItemStack,
  Player,
  Vec2,
} from '../core/types';
import type { Rng } from '../core/rng';
import {
  BOMB_DAMAGE,
  BOMB_RADIUS,
  INVENTORY_SIZE,
  MAX_STACK,
  POTION_HEAL,
  SPAWN_MIN_DISTANCE,
  chestsPerFloor,
  equipmentDropChance,
  goldPileAmount,
  goldPilesPerFloor,
} from '../core/constants';
import { addLog, addLogOnce } from '../core/log';
import { ITEMS } from '../data/items';
import { compareEquipment, equipmentAt, toEquipment } from '../data/equipment';
import { UNREACHABLE, bfsDistances, chebyshev, tileAt, tileIndex } from './dungeon';
import { equip } from './progression';
import { gainGold } from './player';
import { damageEnemy } from './combat';

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
  const candidates = placeableTiles(dungeon, occupied);
  rng.shuffle(candidates);

  const payloads: EntityPayload[] = [];

  for (const item of ITEMS) {
    const count = item.perFloor(floor, rng.next());
    for (let i = 0; i < count; i++) {
      payloads.push({ type: 'item', itemId: item.id, count: 1 });
    }
  }
  for (let i = 0; i < goldPilesPerFloor(rng.next()); i++) {
    payloads.push({ type: 'gold', amount: goldPileAmount(floor, rng.next()) });
  }
  for (let i = 0; i < chestsPerFloor(rng.next()); i++) {
    payloads.push({ type: 'chest', opened: false });
  }
  if (rng.chance(equipmentDropChance(floor))) {
    payloads.push({
      type: 'equipment',
      equipment: toEquipment(rng.pick(equipmentAt(floor))),
      declinedAgainst: null,
    });
  }

  const entities: Entity[] = [];
  for (let i = 0; i < payloads.length && i < candidates.length; i++) {
    const payload = payloads[i] as EntityPayload;
    entities.push({
      id: `entity-${nextEntityId++}`,
      kind: payload.type,
      pos: { ...(candidates[i] as Vec2) },
      payload,
    });
  }
  return entities;
}

function placeableTiles(dungeon: Dungeon, occupied: readonly Vec2[]): Vec2[] {
  const dist = bfsDistances(dungeon, dungeon.start);
  const taken = new Set(occupied.map((p) => tileIndex(dungeon, p.x, p.y)));

  const tiles: Vec2[] = [];
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const i = tileIndex(dungeon, x, y);
      if ((dist[i] ?? UNREACHABLE) < SPAWN_MIN_DISTANCE) continue;
      if (taken.has(i)) continue;
      if (x === dungeon.stairs.x && y === dungeon.stairs.y) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// --- 拾得 --------------------------------------------------------------------

/** プレイヤーの足元にある物を処理する。移動のたびに呼ばれる。 */
export function pickupAt(state: GameState, pos: Vec2): void {
  const index = state.entities.findIndex((e) => e.pos.x === pos.x && e.pos.y === pos.y);
  if (index === -1) return;

  const entity = state.entities[index] as Entity;
  if (collect(state, entity)) state.entities.splice(index, 1);
}

/** @returns 床から取り除いてよいか */
function collect(state: GameState, entity: Entity): boolean {
  const payload = entity.payload;
  switch (payload.type) {
    case 'gold': {
      const amount = gainGold(state, payload.amount);
      addLog(state.log, 'log.pickupGold', { amount }, 'gold');
      return true;
    }
    case 'item':
      return collectItem(state, entity, payload.itemId, payload.count);
    case 'equipment':
      return collectEquipment(state, entity, payload);
    case 'chest': {
      state.stats.chestsOpened += 1;
      addLog(state.log, 'log.openChest', {}, 'gold');
      // 中身はその場で受け取る。受け取れなかった分（満杯・弱い装備）は
      // 同じマスに残して拾い直せるようにする。
      const reward: Entity = { ...rollChestReward(state), pos: { ...entity.pos } };
      if (!collect(state, reward)) state.entities.push(reward);
      return true;
    }
  }
}

function collectItem(state: GameState, entity: Entity, itemId: ItemId, count: number): boolean {
  const accepted = addToInventory(state.player, itemId, count);
  if (accepted === 0) {
    // 満杯なら床に残す。勝手に消えると「拾えなかった」ことに気づけない。
    // 同じマスに立ち続けても繰り返し積まないよう addLogOnce を使う。
    addLogOnce(state.log, 'log.inventoryFull', {}, 'bad');
    return false;
  }
  addLog(state.log, 'log.pickup', { item: itemId, count: accepted }, 'gold');

  if (accepted < count && entity.payload.type === 'item') {
    entity.payload.count = count - accepted; // 入り切らなかった分は床に残す
    return false;
  }
  return true;
}

/**
 * 装備を踏んだときの処理。
 *
 * - 空きスロット / 明確な上位互換 → 自動で装備する。判断の余地がないものを尋ねない
 * - 明確な下位互換 → 何もしない。通り道の弱い装備で事故的に弱体化させない
 * - トレードオフ → プレイヤーに選ばせる。ここが装備をビルドの選択肢にしている部分
 *
 * 入れ替えた場合、外した方はその場に落として拾い直せるようにする。
 */
function collectEquipment(
  state: GameState,
  entity: Entity,
  payload: Extract<EntityPayload, { type: 'equipment' }>,
): boolean {
  const player = state.player;
  const current = player.equipment[payload.equipment.slot];

  switch (compareEquipment(payload.equipment, current)) {
    case 'better':
      return swapEquipment(state, entity, payload.equipment);

    case 'worse':
      addLogOnce(state.log, 'log.equipWorse', { name: payload.equipment.name }, 'info');
      return false;

    case 'sidegrade': {
      // 一度断った組み合わせは尋ね直さない。ただし装備が変われば答えも変わるので、
      // 「何に対して断ったか」を覚えておき、別の装備になっていればもう一度尋ねる。
      if (current && payload.declinedAgainst === current.id) {
        addLogOnce(state.log, 'log.equipKept', { name: payload.equipment.name }, 'info');
        return false;
      }
      state.pendingChoices.push({
        kind: 'equipment',
        entityId: entity.id,
        candidate: payload.equipment,
        // sidegrade は current が null では起きない（null は必ず 'better'）
        current: current as Equipment,
      });
      return false;
    }
  }
}

/**
 * 装備を着け替え、外した物を同じマスに残す。
 * @returns 床から取り除いてよいか（外した物がなければ取り除く）
 */
export function swapEquipment(state: GameState, entity: Entity, next: Equipment): boolean {
  const removed = equip(state.player, next);
  addLog(state.log, 'log.equip', { name: next.name }, 'good');

  if (!removed) return true;

  // 外した装備は同じマスに置き直す。拾い直せる = 選び直せる。
  entity.payload = { type: 'equipment', equipment: removed, declinedAgainst: null };
  entity.kind = 'equipment';
  return false;
}

function rollChestReward(state: GameState): Omit<Entity, 'pos'> {
  const rng = state.rng;
  const floor = state.floor;
  const roll = rng.next();

  let payload: EntityPayload;
  if (roll < 0.45) {
    payload = { type: 'gold', amount: goldPileAmount(floor, rng.next()) * 2 };
  } else if (roll < 0.8) {
    payload = { type: 'item', itemId: rng.pick(ITEMS).id, count: 1 };
  } else {
    payload = {
      type: 'equipment',
      equipment: toEquipment(rng.pick(equipmentAt(floor))),
      declinedAgainst: null,
    };
  }
  return { id: `entity-${nextEntityId++}`, kind: payload.type, payload };
}

/**
 * 入る分だけ入れて、実際に受け取った個数を返す。
 *
 * 1スロットの上限を超えたら次のスロットへ送る。上限がないと同種のアイテムが
 * 1スロットに無限に積み上がり、スロット数が持ち運び量の制限として機能しない。
 */
function addToInventory(player: Player, itemId: ItemId, count: number): number {
  let remaining = count;

  for (const slot of player.inventory) {
    if (remaining === 0) break;
    if (slot?.itemId !== itemId) continue;
    const room = MAX_STACK - slot.count;
    if (room <= 0) continue;
    const put = Math.min(room, remaining);
    slot.count += put;
    remaining -= put;
  }

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
    case 'bomb':
      return detonate(state);
    default:
      // 新しいアイテムを ItemId に足したらここで型エラーになる。
      // 分岐を書き忘れたまま「飲むと回復する」挙動を引き継がせないための番人。
      return assertNever(itemId);
  }
}

/**
 * 周囲の敵にダメージを与え、壁を壊す。
 * 敵にも壁にも当たらなければ何も起きないので、消費もしない。
 */
function detonate(state: GameState): boolean {
  const origin = state.player.pos;
  const dungeon = state.dungeon;

  let hits = 0;
  // 直接 hp を引かずに damageEnemy を通す。爆殺でも経験値とゴールドが入る。
  for (const enemy of [...state.enemies]) {
    if (enemy.hp <= 0) continue;
    if (chebyshev(enemy.pos, origin) > BOMB_RADIUS) continue;
    damageEnemy(state, enemy, BOMB_DAMAGE);
    hits += 1;
  }

  let broken = 0;
  for (let dy = -BOMB_RADIUS; dy <= BOMB_RADIUS; dy++) {
    for (let dx = -BOMB_RADIUS; dx <= BOMB_RADIUS; dx++) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      // 外周は壊さない。壊すとグリッドの外へ抜けられてしまう。
      if (x <= 0 || y <= 0 || x >= dungeon.width - 1 || y >= dungeon.height - 1) continue;
      if (tileAt(dungeon, x, y) !== 'wall') continue;
      dungeon.tiles[tileIndex(dungeon, x, y)] = 'floor';
      broken += 1;
    }
  }

  if (hits === 0 && broken === 0) {
    addLogOnce(state.log, 'log.bombDud', {}, 'info');
    return false;
  }
  addLog(state.log, 'log.useBomb', { hits, broken }, 'good');
  return true;
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
