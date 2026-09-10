import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '../src/core/types';
import { ENEMIES } from '../src/data/enemies';
import { EVENTS } from '../src/data/events';
import { FIRST_RARE_FLOOR } from '../src/data/equipment';
import { createGame, descend } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { pickupAt } from '../src/game/loot';
import { spawnGuardian } from '../src/game/enemy';

/**
 * コードレビューで見つかった不具合の退行テスト。
 * どれも「一度は本番に入った」ものなので、消さずに残す。
 */

describe('イベントの二重発火', () => {
  it('同じマスを踏み直しても選択は1つしか積まれない', () => {
    const state = createGame(1);
    const entity: Entity = {
      id: 'ev',
      kind: 'event',
      pos: { ...state.player.pos },
      payload: { type: 'event', eventId: 'healingSpring' },
    };
    state.entities = [entity];

    // Swift Step でターンを消費せず踏み直した状況
    pickupAt(state, state.player.pos);
    pickupAt(state, state.player.pos);
    pickupAt(state, state.player.pos);

    expect(state.pendingChoices.length, '同じイベントが複数回積まれている').toBe(1);
  });

  it('二重に積まれないので効果も1回しか起きない', () => {
    const state = createGame(2);
    state.player.hp = 1;
    state.entities = [
      {
        id: 'ev',
        kind: 'event',
        pos: { ...state.player.pos },
        payload: { type: 'event', eventId: 'healingSpring' },
      },
    ];
    const enemiesBefore = state.enemies.length;

    pickupAt(state, state.player.pos);
    pickupAt(state, state.player.pos);
    takeTurn(state, { type: 'wait' });
    takeTurn(state, { type: 'choose', index: 0 });

    expect(state.phase, 'まだ選択が残っている').toBe('playing');
    // 泉は敵を2体増やす。二重発火なら4体増える。
    expect(state.enemies.length - enemiesBefore).toBeLessThanOrEqual(2);
  });
});

describe('イベントで湧く敵も出現階を守る', () => {
  it('指定した種類が出現階に達していなければ、その種類は出さない', () => {
    const warden = ENEMIES.find((e) => e.kind === 'warden');
    expect(warden).toBeDefined();
    const tooShallow = (warden?.minFloor ?? 7) - 1;

    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed * 19);
      state.floor = tooShallow;
      spawnGuardian(state, 3, 'warden');

      expect(
        state.enemies.some((e) => e.kind === 'warden'),
        `${tooShallow} 階に Warden が湧いた`,
      ).toBe(false);
    }
  });

  it('出現階に達していれば指定どおり出る', () => {
    const warden = ENEMIES.find((e) => e.kind === 'warden');
    const floor = warden?.minFloor ?? 7;
    const state = createGame(3);
    state.floor = floor;
    spawnGuardian(state, 1, 'warden');
    expect(state.enemies.some((e) => e.kind === 'warden')).toBe(true);
  });

  it('宝物庫の出現階が Warden の出現階以上になっている', () => {
    const treasury = EVENTS.find((e) => e.id === 'treasury');
    const warden = ENEMIES.find((e) => e.kind === 'warden');
    expect(treasury?.minFloor).toBeGreaterThanOrEqual(warden?.minFloor ?? 7);
  });

  it('イベントで湧いた敵も生成時の出現階を守る', () => {
    const limits = new Map(ENEMIES.map((e) => [e.kind, e.minFloor]));
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame(seed * 23);
      for (let i = 0; i < 8; i++) {
        spawnGuardian(state, 2);
        for (const enemy of state.enemies) {
          expect(state.floor).toBeGreaterThanOrEqual(limits.get(enemy.kind) ?? 1);
        }
        descend(state);
      }
    }
  });
});

describe('施錠された宝箱の約束', () => {
  it('レア以上が存在しない階では宝箱を施錠しない', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = createGame(seed * 11);
      while (state.floor < FIRST_RARE_FLOOR) {
        for (const entity of state.entities) {
          if (entity.payload.type === 'chest') {
            expect(
              entity.payload.locked,
              `${state.floor} 階（レアが存在しない）で施錠された宝箱が生成された`,
            ).toBe(false);
          }
        }
        descend(state);
      }
    }
  });

  it('施錠された宝箱の中身は必ずレア以上', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const floor of [FIRST_RARE_FLOOR, 8, 15]) {
        const state = createGame(seed * 5);
        state.floor = floor;
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

        const worn =
          state.player.equipment.weapon ??
          state.player.equipment.armor ??
          state.player.equipment.ring;
        const left = state.entities.find((e) => e.payload.type === 'equipment');
        const gained = worn ?? (left?.payload.type === 'equipment' ? left.payload.equipment : null);

        expect(gained, `seed=${seed} floor=${floor} 装備が出ていない`).not.toBeNull();
        expect(gained?.rarity, `seed=${seed} floor=${floor} common が出た`).not.toBe('common');
      }
    }
  });

  it('鍵は使い道がない階には落ちていない', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed * 7);
      while (state.floor < FIRST_RARE_FLOOR - 1) {
        for (const entity of state.entities) {
          if (entity.payload.type === 'item') {
            expect(
              entity.payload.itemId,
              `${state.floor} 階に使い道のない鍵が落ちている`,
            ).not.toBe('key');
          }
        }
        descend(state);
      }
    }
  });
});

describe('ログの差分を長さで取らない', () => {
  it('ログが上限に達しても新規エントリを取り出せる', async () => {
    const { MAX_LOG } = await import('../src/core/constants');
    const { addLog } = await import('../src/core/log');
    const state = createGame(31);

    while (state.log.length < MAX_LOG) {
      addLog(state.log, 'log.playerHit', { name: 'x', damage: 1 });
    }
    const lastId = state.log[state.log.length - 1]?.id ?? -1;

    addLog(state.log, 'log.enemyDies', { name: 'y', exp: 1 });
    addLog(state.log, 'log.levelUp', { level: 2, healed: 3 });

    // 長さで区切ると 0 件になる（切り捨てで境界が意味を失う）
    expect(state.log.length).toBe(MAX_LOG);
    const byId = state.log.filter((e) => e.id > lastId);
    expect(byId.length, 'id の差分で新規が取れていない').toBe(2);
    expect(byId.map((e) => e.key)).toEqual(['log.enemyDies', 'log.levelUp']);
  });

  it('ログの id が単調増加する', async () => {
    const { addLog } = await import('../src/core/log');
    const state = createGame(32);
    for (let i = 0; i < 120; i++) addLog(state.log, 'log.playerHit', { name: 'x', damage: 1 });

    const ids = state.log.map((e) => e.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] as number).toBeGreaterThan(ids[i - 1] as number);
    }
  });
});

describe('実績ログの表示', () => {
  it('プレースホルダが残らず、実績名に置き換わる', async () => {
    const { logAchievements } = await import('../src/game/achievements');
    const { t } = await import('../src/ui/i18n');
    const state = createGame(33);

    logAchievements(state, ['firstBlood']);
    const entry = state.log[state.log.length - 1];
    expect(entry?.key).toBe('log.achievement');

    // game/ は表示名を知らないので id しか入っていない。
    // 置き換えは ui/ の仕事で、そのままだと {name} が画面に出る。
    for (const lang of ['en', 'ja'] as const) {
      const raw = t(lang, 'log.achievement', entry?.params ?? {});
      expect(raw, `${lang}: 直接描画すると壊れることの確認`).toContain('{name}');

      const fixed = t(lang, 'log.achievement', {
        name: t(lang, 'ach.firstBlood'),
      });
      expect(fixed).not.toContain('{');
      expect(fixed).toContain(t(lang, 'ach.firstBlood'));
    }
  });
});

describe('とどめの一撃のダメージ表示', () => {
  it('倒した敵もそのターンの描画までは配列に残る', () => {
    const state = createGame(34);
    state.enemies = [];
    const target = {
      id: 'victim',
      kind: 'goblin' as const,
      name: 'Goblin',
      ai: 'chase' as const,
      pos: { x: state.player.pos.x + 1, y: state.player.pos.y },
      hp: 1,
      maxHp: 20,
      attack: 1,
      defense: 0,
      speed: 1,
      exp: 5,
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
    state.enemies.push(target);

    takeTurn(state, { type: 'move', dir: 'right' });

    // 描画は takeTurn の直後に走る。ここで消えているとダメージ数値が出ない。
    const corpse = state.enemies.find((e) => e.id === 'victim');
    expect(corpse, 'とどめを刺した敵が描画前に消えている').toBeDefined();
    expect(corpse?.hp).toBe(0);
    expect(corpse?.hurtOnTurn).toBe(state.turn);
    expect(corpse?.lastDamage).toBeGreaterThan(0);

    // 次のターンの開始時に片付けられる
    takeTurn(state, { type: 'wait' });
    expect(state.enemies.some((e) => e.id === 'victim')).toBe(false);
  });
});

describe('効果音の初期化', () => {
  it('設定を有効にしただけでは AudioContext を作らない', async () => {
    let constructed = 0;
    class FakeContext {
      state = 'running';
      currentTime = 0;
      constructor() {
        constructed += 1;
      }
      createOscillator() {
        return {
          type: '',
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect: () => ({ connect() {} }),
          start() {},
          stop() {},
        };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) };
      }
    }
    vi.stubGlobal('window', { AudioContext: FakeContext });

    const { setSoundEnabled } = await import('../src/audio/sfx');
    setSoundEnabled(true);

    // 保存された設定が ON のまま再訪すると、この呼び出しは読み込み中に起きる。
    // ここで作ると自動再生ポリシーで suspended のまま残る。
    expect(constructed, '読み込み中に AudioContext を作っている').toBe(0);

    vi.unstubAllGlobals();
    setSoundEnabled(false);
  });
});
