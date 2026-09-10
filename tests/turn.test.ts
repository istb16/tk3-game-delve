import { describe, expect, it } from 'vitest';
import type { Enemy, GameState } from '../src/core/types';
import { createGame } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { gainExp } from '../src/game/player';
import { isWalkable } from '../src/game/dungeon';

function snapshotEnemies(state: GameState): string {
  return JSON.stringify(state.enemies.map((e) => [e.pos.x, e.pos.y, e.hp]));
}

function placeEnemy(state: GameState, dx: number, dy: number, hp = 100): Enemy {
  const enemy: Enemy = {
    id: `test-${dx}-${dy}`,
    kind: 'goblin',
    name: 'Goblin',
    ai: 'chase',
    pos: { x: state.player.pos.x + dx, y: state.player.pos.y + dy },
    hp,
    maxHp: hp,
    attack: 5,
    defense: 0,
    speed: 1,
    exp: 6,
    gold: 5,
    steps: 0,
    hurtOnTurn: -1,
    lastDamage: 0,
    effects: [],
    evasion: 0,
    ability: null,
    revived: false,
    split: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

/** 壁に向かう方向を探す。見つからなければ null。 */
function wallDirection(state: GameState): 'up' | 'down' | 'left' | 'right' | null {
  const { x, y } = state.player.pos;
  if (!isWalkable(state.dungeon, x, y - 1)) return 'up';
  if (!isWalkable(state.dungeon, x, y + 1)) return 'down';
  if (!isWalkable(state.dungeon, x - 1, y)) return 'left';
  if (!isWalkable(state.dungeon, x + 1, y)) return 'right';
  return null;
}

describe('ターン進行', () => {
  it('壁への移動はターンを消費しない（敵が動かない）', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = createGame(seed * 37);
      const dir = wallDirection(state);
      if (!dir) continue;

      placeEnemy(state, 2, 0);
      const before = snapshotEnemies(state);
      const posBefore = { ...state.player.pos };

      takeTurn(state, { type: 'move', dir });

      expect(state.player.pos).toEqual(posBefore);
      expect(snapshotEnemies(state)).toBe(before);
    }
  });

  it('死亡後は移動入力が状態を変えない', () => {
    const state = createGame(7);
    state.phase = 'dead';
    const posBefore = { ...state.player.pos };
    const enemiesBefore = snapshotEnemies(state);

    takeTurn(state, { type: 'move', dir: 'left' });
    takeTurn(state, { type: 'wait' });

    expect(state.player.pos).toEqual(posBefore);
    expect(snapshotEnemies(state)).toBe(enemiesBefore);
  });

  it('HP が 0 の敵は行動しない', () => {
    const state = createGame(9);
    const enemy = placeEnemy(state, 3, 0, 1);
    enemy.hp = 0;

    takeTurn(state, { type: 'wait' });

    // 死体は毎ターンの終わりに掃除される
    expect(state.enemies.some((e) => e.id === enemy.id)).toBe(false);
  });

  it('敵はプレイヤーのマスに侵入しない', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createGame(seed * 13);
      for (let i = 0; i < 60 && state.phase !== 'dead'; i++) {
        if (state.phase === 'choosing') {
          takeTurn(state, { type: 'choose', index: 0 });
          continue;
        }
        takeTurn(state, { type: 'wait' });
        for (const enemy of state.enemies) {
          expect(enemy.pos, `seed=${seed}`).not.toEqual(state.player.pos);
        }
      }
    }
  });

  it('選択待ち中は移動できず、選ぶと解ける', () => {
    const state = createGame(21);
    gainExp(state, 8); // 1 レベル分
    expect(state.pendingChoices.length).toBe(1);

    takeTurn(state, { type: 'wait' });
    expect(state.phase).toBe('choosing');

    const posBefore = { ...state.player.pos };
    takeTurn(state, { type: 'move', dir: 'right' });
    expect(state.player.pos, '選択待ち中に移動できてしまう').toEqual(posBefore);

    // 範囲外の選択は無視され、モーダルは閉じない
    takeTurn(state, { type: 'choose', index: 99 });
    expect(state.phase).toBe('choosing');

    takeTurn(state, { type: 'choose', index: 0 });
    expect(state.phase).toBe('playing');
    expect(state.player.perks.length).toBe(1);
  });

  it('1ターンで複数レベル上がっても選択が取りこぼされない', () => {
    const state = createGame(22);
    gainExp(state, 1000);
    const queued = state.pendingChoices.length;
    expect(queued).toBeGreaterThan(1);

    takeTurn(state, { type: 'wait' });
    for (let i = 0; i < queued; i++) {
      expect(state.phase).toBe('choosing');
      takeTurn(state, { type: 'choose', index: 0 });
    }
    expect(state.phase).toBe('playing');
    expect(state.player.perks.length).toBe(queued);
  });

  it('階段を降りた直後は新フロアの敵が行動しない', () => {
    let tested = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed * 53);
      const stairs = state.dungeon.stairs;

      // 階段の隣に立たせて、1歩で必ず踏ませる
      const spot = [
        { d: 'up' as const, x: stairs.x, y: stairs.y + 1 },
        { d: 'down' as const, x: stairs.x, y: stairs.y - 1 },
        { d: 'left' as const, x: stairs.x + 1, y: stairs.y },
        { d: 'right' as const, x: stairs.x - 1, y: stairs.y },
      ].find((c) => isWalkable(state.dungeon, c.x, c.y));
      if (!spot) continue;

      state.player.pos = { x: spot.x, y: spot.y };
      // 隣の敵に殴られる可能性を排除して、降下ターンの被弾だけを見る
      state.enemies = [];
      const floorBefore = state.floor;
      const hpBefore = state.player.hp;

      takeTurn(state, { type: 'move', dir: spot.d });

      expect(state.floor, `seed=${seed} 階段を踏んだのに降りていない`).toBe(floorBefore + 1);
      expect(state.player.hp).toBeGreaterThanOrEqual(hpBefore);
      // 新フロアの敵は1歩も動いていない
      expect(state.enemies.every((e) => e.steps === 0)).toBe(true);
      tested += 1;
    }

    expect(tested, '検証できたケースが少なすぎる').toBeGreaterThan(30);
  });
});

describe('ログの順序', () => {
  it('とどめの一撃は撃破ログより先に出る', () => {
    const state = createGame(101);
    placeEnemy(state, 1, 0, 1);
    const before = state.log.length;

    takeTurn(state, { type: 'move', dir: 'right' });

    const keys = state.log.slice(before).map((e) => e.key);
    const hit = keys.findIndex((k) => k === 'log.playerHit' || k === 'log.critical');
    const dies = keys.indexOf('log.enemyDies');
    expect(hit, '命中ログがない').toBeGreaterThanOrEqual(0);
    expect(dies, '撃破ログがない').toBeGreaterThanOrEqual(0);
    expect(hit, '撃破が命中より先に記録されている').toBeLessThan(dies);
  });
});
