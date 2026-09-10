import type { GameState, ItemId, Vec2 } from '../../src/core/types';
import { createGame } from '../../src/game/state';
import { takeTurn } from '../../src/game/turn';
import { enemyAt } from '../../src/game/enemy';
import { bfsDistances, isWalkable, tileIndex } from '../../src/game/dungeon';

/**
 * 「上手くないプレイヤー」を近似した自動プレイヤー。
 *
 * 難易度カーブの検証に使う（docs/07 §7.8, docs/08 §8.3）。
 * わざと下手に作ってある — 逃げない、通路に誘い込まない、囲まれても引かない。
 * ここを賢くすると「上手い人の到達階層」を測ることになり、目標とずれる。
 */
export interface BotOptions {
  /** この割合を下回ったらポーションを飲む。プレイヤーの腕を表す唯一のつまみ。 */
  healBelow?: number;
  maxTurns?: number;
  maxFloor?: number;
}

export interface BotResult {
  floor: number;
  level: number;
  kills: number;
  gold: number;
  perks: number;
  turns: number;
  /** 打ち切りに達した = どこかで進行不能になっている疑い */
  timedOut: boolean;
  state: GameState;
}

/** 回復に使えるアイテム。増えたらここに足す。 */
const HEALING: ReadonlySet<ItemId> = new Set<ItemId>(['potion', 'elixir']);

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function dirOf(dx: number, dy: number): 'up' | 'down' | 'left' | 'right' {
  if (dx === 1) return 'right';
  if (dx === -1) return 'left';
  return dy === 1 ? 'down' : 'up';
}

export function runBot(seed: number, options: BotOptions = {}): BotResult {
  const healBelow = options.healBelow ?? 0.5;
  const maxTurns = options.maxTurns ?? 8000;
  const maxFloor = options.maxFloor ?? 80;

  const state = createGame(seed);
  // 一度踏んで拾えなかった物（弱い装備・満杯で入らなかったアイテム）は
  // 二度と目標にしない。これがないとその上で永久に往復する。
  const ignored = new Set<string>();
  let turns = 0;

  while (state.phase !== 'dead' && turns < maxTurns && state.floor < maxFloor) {
    turns += 1;

    if (state.phase === 'choosing') {
      // 吟味せず最初の選択肢を取る。
      // 装備の持ち替えでも index 0（拾った方に持ち替える）を選ぶ —
      // 「新しくて光っている物に飛びつく」のが下手なプレイヤーの振る舞い。
      takeTurn(state, { type: 'choose', index: 0 });
      continue;
    }

    if (state.player.hp < state.player.maxHp * healBelow) {
      // 回復アイテムなら種類を問わず飲む。下手なプレイヤーは「大きい方を取っておく」
      // 判断をしない。ここを賢くすると上手い人の到達階層を測ることになる。
      const slot = state.player.inventory.findIndex(
        (s) => s !== null && HEALING.has(s.itemId) && s.count > 0,
      );
      if (slot >= 0) {
        takeTurn(state, { type: 'useItem', slot });
        continue;
      }
    }

    for (const entity of state.entities) {
      if (entity.pos.x === state.player.pos.x && entity.pos.y === state.player.pos.y) {
        ignored.add(entity.id);
      }
    }

    const dir = chooseDirection(state, ignored);
    if (!dir) break;
    takeTurn(state, { type: 'move', dir });
  }

  return {
    floor: state.stats.deepestFloor,
    level: state.player.level,
    kills: state.stats.kills,
    gold: state.stats.goldEarned,
    perks: state.player.perks.length,
    turns,
    timedOut: turns >= maxTurns,
    state,
  };
}

function chooseDirection(
  state: GameState,
  ignored: ReadonlySet<string>,
): 'up' | 'down' | 'left' | 'right' | null {
  // 隣に敵がいれば殴り返す
  for (const [dx, dy] of STEPS) {
    if (enemyAt(state.enemies, state.player.pos.x + dx, state.player.pos.y + dy)) {
      return dirOf(dx, dy);
    }
  }

  const wanted = state.entities.filter((e) => !ignored.has(e.id));
  const goal: Vec2 = wanted[0]?.pos ?? state.dungeon.stairs;
  const dist = bfsDistances(state.dungeon, goal);

  let best: 'up' | 'down' | 'left' | 'right' | null = null;
  let bestDist = Infinity;
  for (const [dx, dy] of STEPS) {
    const nx = state.player.pos.x + dx;
    const ny = state.player.pos.y + dy;
    if (!isWalkable(state.dungeon, nx, ny)) continue;
    const value = dist[tileIndex(state.dungeon, nx, ny)] ?? -1;
    if (value >= 0 && value < bestDist) {
      bestDist = value;
      best = dirOf(dx, dy);
    }
  }
  return best;
}

export interface Distribution {
  median: number;
  min: number;
  max: number;
  mean: number;
  bands: Record<string, number>;
  meanLevel: number;
  meanTurns: number;
  timedOut: number;
}

export function summarize(count: number, options: BotOptions = {}): Distribution {
  const runs: BotResult[] = [];
  for (let seed = 1; seed <= count; seed++) runs.push(runBot(seed * 7919, options));

  const floors = runs.map((r) => r.floor).sort((a, b) => a - b);
  const band = (lo: number, hi: number): number =>
    floors.filter((f) => f >= lo && f <= hi).length;

  return {
    median: floors[Math.floor(count / 2)] as number,
    min: floors[0] as number,
    max: floors[count - 1] as number,
    mean: +(floors.reduce((a, b) => a + b, 0) / count).toFixed(1),
    bands: {
      '1-4': band(1, 4),
      '5-9': band(5, 9),
      '10-15': band(10, 15),
      '16-25': band(16, 25),
      '26+': band(26, 9999),
    },
    meanLevel: +(runs.reduce((s, r) => s + r.level, 0) / count).toFixed(1),
    meanTurns: Math.round(runs.reduce((s, r) => s + r.turns, 0) / count),
    timedOut: runs.filter((r) => r.timedOut).length,
  };
}
