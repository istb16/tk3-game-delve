import type { Dungeon, TileKind, Vec2 } from '../core/types';
import type { Rng } from '../core/rng';
import { GRID_SIZE, VIEW_RADIUS } from '../core/constants';

/** bfsDistances が到達不能マスに入れる値 */
export const UNREACHABLE = -1;

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- タイルアクセス ----------------------------------------------------------

export function tileIndex(d: Dungeon, x: number, y: number): number {
  return y * d.width + x;
}

/** 範囲外は 'wall' 扱い。境界チェックをここ1箇所に集約する。 */
export function tileAt(d: Dungeon, x: number, y: number): TileKind {
  if (x < 0 || y < 0 || x >= d.width || y >= d.height) return 'wall';
  return d.tiles[y * d.width + x] ?? 'wall';
}

export function isWalkable(d: Dungeon, x: number, y: number): boolean {
  return tileAt(d, x, y) !== 'wall';
}

// --- 生成 --------------------------------------------------------------------

/**
 * 部屋 + 通路方式。詳細は docs/06-dungeon-generation.md。
 *
 * 到達可能性は「生成 -> 検証 -> 駄目なら作り直し」ではなく、
 * 部屋を生成順に鎖状に接続することで構造的に保証する。
 */
export function generateDungeon(rng: Rng, floor: number): Dungeon {
  // 階段がすぐ目の前にあるフロアは探索の意味がないので、遠さを確保できるまで作り直す。
  const minSpan = Math.floor((GRID_SIZE + GRID_SIZE) / 4);

  let fallback: Dungeon | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    // 試行ごとに部屋を1つ増やすと、階段を遠くに置ける余地が広がる。
    const dungeon = buildLayout(rng, floor, attempt);
    const dist = bfsDistances(dungeon, dungeon.start);
    const span = dist[tileIndex(dungeon, dungeon.stairs.x, dungeon.stairs.y)] ?? UNREACHABLE;
    if (span >= minSpan) return dungeon;
    fallback = dungeon;
  }
  // 4回とも届かない場合はそのまま返す。到達可能性自体は常に成立している。
  return fallback as Dungeon;
}

function buildLayout(rng: Rng, floor: number, extraRooms: number): Dungeon {
  const width = GRID_SIZE;
  const height = GRID_SIZE;
  const tiles: TileKind[] = new Array<TileKind>(width * height).fill('wall');

  const roomCount = clamp(4 + Math.floor(floor / 3), 4, 9) + extraRooms;
  const roomSizeMax = clamp(4 + Math.floor(floor / 6), 4, 6);

  // 1. 部屋を重ならないように配置する（置けなかった分は諦める）
  const rooms: Room[] = [];
  for (let tries = 0; tries < 60 && rooms.length < roomCount; tries++) {
    const w = rng.int(3, roomSizeMax + 1);
    const h = rng.int(3, roomSizeMax + 1);
    const room: Room = {
      x: rng.int(1, width - w),
      y: rng.int(1, height - h),
      w,
      h,
    };
    if (rooms.some((other) => overlaps(other, room))) continue;
    rooms.push(room);
  }

  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        tiles[y * width + x] = 'floor';
      }
    }
  }

  // 2. 生成順に隣接ペアを接続 -> 全部屋が一本の鎖で必ず連結される（到達可能性の根拠）
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(tiles, width, center(rooms[i - 1] as Room), center(rooms[i] as Room), rng);
  }

  // 3. 深い階ではループを足して一本道の単調さを消す
  const extraLoops = clamp(Math.floor(floor / 4), 0, 3);
  for (let i = 0; i < extraLoops && rooms.length > 2; i++) {
    const a = rng.pick(rooms);
    const b = rng.pick(rooms);
    if (a !== b) carveCorridor(tiles, width, center(a), center(b), rng);
  }

  const start = rooms.length > 0 ? center(rooms[0] as Room) : { x: 1, y: 1 };
  if (rooms.length === 0) tiles[start.y * width + start.x] = 'floor';

  const dungeon: Dungeon = {
    width,
    height,
    tiles,
    explored: new Array<boolean>(width * height).fill(false),
    visible: new Array<boolean>(width * height).fill(false),
    start,
    stairs: start,
  };

  // 4. start から最も遠い部屋の中心を階段にする（ランダムだと目の前に出て退屈になる）
  dungeon.stairs = farthestRoomCenter(dungeon, rooms, start);
  tiles[dungeon.stairs.y * width + dungeon.stairs.x] = 'stairs';

  return dungeon;
}

function farthestRoomCenter(d: Dungeon, rooms: readonly Room[], from: Vec2): Vec2 {
  const dist = bfsDistances(d, from);
  let best = from;
  let bestDist = -1;
  for (const room of rooms) {
    const c = center(room);
    const value = dist[tileIndex(d, c.x, c.y)] ?? UNREACHABLE;
    if (value > bestDist) {
      bestDist = value;
      best = c;
    }
  }
  return best;
}

function center(room: Room): Vec2 {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

/** 1マスの余白を含めて判定し、部屋同士がくっつくのを防ぐ。 */
function overlaps(a: Room, b: Room): boolean {
  return (
    a.x - 1 < b.x + b.w &&
    a.x + a.w + 1 > b.x &&
    a.y - 1 < b.y + b.h &&
    a.y + a.h + 1 > b.y
  );
}

/** L 字通路。水平->垂直 か 垂直->水平 をランダムに選ぶ。 */
function carveCorridor(tiles: TileKind[], width: number, from: Vec2, to: Vec2, rng: Rng): void {
  const horizontalFirst = rng.chance(0.5);
  const corner: Vec2 = horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  carveLine(tiles, width, from, corner);
  carveLine(tiles, width, corner, to);
}

function carveLine(tiles: TileKind[], width: number, from: Vec2, to: Vec2): void {
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  let x = from.x;
  let y = from.y;
  tiles[y * width + x] = 'floor';
  while (x !== to.x || y !== to.y) {
    if (x !== to.x) x += stepX;
    else y += stepY;
    tiles[y * width + x] = 'floor';
  }
}

// --- 探索 --------------------------------------------------------------------

/** from からの4近傍 BFS 距離。到達不能は UNREACHABLE。 */
export function bfsDistances(d: Dungeon, from: Vec2): number[] {
  const dist = new Array<number>(d.width * d.height).fill(UNREACHABLE);
  if (!isWalkable(d, from.x, from.y)) return dist;

  dist[tileIndex(d, from.x, from.y)] = 0;

  const queue: Vec2[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as Vec2;
    const curDist = dist[tileIndex(d, cur.x, cur.y)] ?? 0;
    for (const step of NEIGHBORS) {
      const nx = cur.x + step[0];
      const ny = cur.y + step[1];
      if (!isWalkable(d, nx, ny)) continue;
      const ni = tileIndex(d, nx, ny);
      if (dist[ni] !== UNREACHABLE) continue;
      dist[ni] = curDist + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}

const NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// --- 視界 --------------------------------------------------------------------

/** プレイヤー位置から visible / explored を更新する。 */
export function updateVisibility(d: Dungeon, from: Vec2): void {
  d.visible.fill(false);
  for (let y = from.y - VIEW_RADIUS; y <= from.y + VIEW_RADIUS; y++) {
    for (let x = from.x - VIEW_RADIUS; x <= from.x + VIEW_RADIUS; x++) {
      if (x < 0 || y < 0 || x >= d.width || y >= d.height) continue;
      if (!hasLineOfSight(d, from, x, y)) continue;
      const i = tileIndex(d, x, y);
      d.visible[i] = true;
      d.explored[i] = true;
    }
  }
}

/**
 * Bresenham で視線上の壁を見る。15x15 の規模ではシャドウキャスティングは過剰。
 * 終点自体が壁でも「壁が見えている」必要があるので、終点は遮蔽判定から外す。
 */
function hasLineOfSight(d: Dungeon, from: Vec2, tx: number, ty: number): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(tx - x);
  const dy = Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    if (x === tx && y === ty) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === tx && y === ty) return true;
    if (tileAt(d, x, y) === 'wall') return false;
  }
}

// --- ユーティリティ ----------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
