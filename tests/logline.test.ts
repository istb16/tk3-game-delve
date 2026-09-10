import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../src/core/types';
import { MAX_STACK } from '../src/core/constants';
import { formatLogEntry } from '../src/ui/logline';
import { createGame } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { pickupAt, useItem } from '../src/game/loot';
import { logAchievements } from '../src/game/achievements';
import { runBot } from './helpers/bot';
import { EVENTS } from '../src/data/events';
import { ITEMS } from '../src/data/items';

const LANGS = ['en', 'ja'] as const;

/** 未置換のプレースホルダが残っていないか。 */
function assertRendered(entry: LogEntry, where: string): void {
  for (const lang of LANGS) {
    const text = formatLogEntry(lang, entry);
    expect(text.length, `${where} ${lang} ${entry.key} が空`).toBeGreaterThan(0);
    expect(text, `${where} ${lang} ${entry.key} にプレースホルダが残っている: ${text}`).not.toMatch(
      /\{[a-zA-Z]+\}/,
    );
  }
}

/**
 * ログの表示は、game/ が積んだ識別子を ui/ が名前に引き当てて初めて完成する。
 * この対応が抜けると `{item}` や `{name}` がそのまま画面に出る。
 * 実際に2回やっているので、機械的に検査する。
 */
describe('ログの表示', () => {
  it('自動プレイで積まれた全てのログが、両言語で破綻せず描画できる', () => {
    const seen = new Map<string, LogEntry>();

    for (let seed = 1; seed <= 12; seed++) {
      const result = runBot(seed * 7919, { maxFloor: 20 });
      for (const entry of result.state.log) {
        // 同じキーは params の組み合わせごとに1件だけ見る
        seen.set(entry.key + JSON.stringify(Object.keys(entry.params).sort()), entry);
      }
    }

    expect(seen.size, '収集できたログの種類が少なすぎる').toBeGreaterThan(8);
    for (const [where, entry] of seen) assertRendered(entry, where);
  }, 120_000);

  it('拾ったアイテムの名前がログに出る（Potion 直書きになっていない）', () => {
    for (const item of ITEMS) {
      const state = createGame(7);
      state.entities = [
        {
          id: 'x',
          kind: 'item',
          pos: { ...state.player.pos },
          payload: { type: 'item', itemId: item.id, count: 1 },
        },
      ];
      pickupAt(state, state.player.pos);

      const entry = state.log[state.log.length - 1];
      expect(entry?.key).toBe('log.pickup');
      assertRendered(entry as LogEntry, `pickup:${item.id}`);

      // 拾った物の名前が実際に含まれていること
      for (const lang of LANGS) {
        expect(formatLogEntry(lang, entry as LogEntry), `${item.id} の名前が出ていない`).toContain(
          item.name,
        );
      }
    }
  });

  it('実績のログに実績名が出る', () => {
    const state = createGame(8);
    logAchievements(state, ['firstBlood']);
    const entry = state.log[state.log.length - 1] as LogEntry;
    assertRendered(entry, 'achievement');
    for (const lang of LANGS) {
      expect(formatLogEntry(lang, entry)).toContain('First Blood');
    }
  });

  it('イベントのログが両言語で破綻しない', () => {
    for (const def of EVENTS) {
      for (const index of [0, def.optionCount - 1]) {
        const state = createGame(9);
        state.player.gold = 500;
        state.floor = 10;
        state.entities = [
          {
            id: 'ev',
            kind: 'event',
            pos: { ...state.player.pos },
            payload: { type: 'event', eventId: def.id },
          },
        ];
        pickupAt(state, state.player.pos);
        takeTurn(state, { type: 'wait' });
        const before = state.log.length;
        takeTurn(state, { type: 'choose', index });

        for (const entry of state.log.slice(before)) {
          assertRendered(entry, `event:${def.id}:${index}`);
        }
      }
    }
  });

  it('巻物のログが両言語で破綻しない', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed * 3);
      state.player.inventory[0] = { itemId: 'scroll', count: 1 };
      const before = state.log.length;
      useItem(state, 0);
      for (const entry of state.log.slice(before)) {
        assertRendered(entry, `scroll:${seed}`);
      }
    }
  });
});

describe('スタックの上限', () => {
  it('同じアイテムでも上限を超えたら別のスロットに分かれる', () => {
    const state = createGame(11);
    state.entities = [];
    for (let i = 0; i < MAX_STACK + 1; i++) {
      state.entities.push({
        id: `p${i}`,
        kind: 'item',
        pos: { ...state.player.pos },
        payload: { type: 'item', itemId: 'potion', count: 1 },
      });
      pickupAt(state, state.player.pos);
    }

    const used = state.player.inventory.filter((s) => s !== null);
    // 「同じ物なのに2枠に分かれる」のは仕様。UI 側で上限を見せて説明する。
    expect(used.length).toBe(2);
    expect(used[0]?.count).toBe(MAX_STACK);
    expect(used[1]?.count).toBe(1);
  });
});

describe('巻物のハズレの演出', () => {
  it('呪いを引いたら赤いフラッシュの条件が立つ', () => {
    let cursed = false;
    for (let seed = 1; seed <= 120 && !cursed; seed++) {
      const state = createGame(seed * 13);
      state.player.inventory[0] = { itemId: 'scroll', count: 1 };
      const turnBefore = state.turn;
      useItem(state, 0);

      if (!state.log.some((e) => e.key === 'log.scrollCurse')) continue;
      cursed = true;

      // 被弾と同じ赤いフラッシュを出すための条件
      expect(state.player.cursedOnTurn, '呪いのターンが記録されていない').toBe(turnBefore);

      // HP は減らないので、ダメージ数値は出さない
      expect(state.player.hurtOnTurn, '呪いでダメージ数値が出てしまう').not.toBe(turnBefore);
    }
    expect(cursed, '120 回引いても呪いが出なかった').toBe(true);
  });

  it('当たりを引いたときは赤いフラッシュを出さない', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = createGame(seed * 7);
      state.player.inventory[0] = { itemId: 'scroll', count: 1 };
      const turn = state.turn;
      useItem(state, 0);

      if (state.log.some((e) => e.key === 'log.scrollCurse')) continue;
      expect(state.player.cursedOnTurn, `seed=${seed} 当たりなのに呪い扱い`).not.toBe(turn);
    }
  });
});

describe('巻物の当たりの演出', () => {
  it('当たりの5種すべてが、それぞれ違う演出を出す', () => {
    const seen = new Map<string, string>();

    for (let seed = 1; seed <= 400 && seen.size < 5; seed++) {
      const state = createGame(seed * 11);
      state.player.inventory[0] = { itemId: 'scroll', count: 1 };
      // 消滅と全体攻撃には敵が要る
      const before = state.log.length;
      useItem(state, 0);

      const keys = state.log.slice(before).map((e) => e.key);
      const outcome = keys.find((k) => k.startsWith('log.scroll'));
      if (!outcome || outcome === 'log.scrollCurse') continue;
      if (state.stageEvent?.turn !== state.turn) continue;
      seen.set(outcome, state.stageEvent.kind);
    }

    expect(seen.size, `見つかった当たりが少ない: ${[...seen.keys()].join(',')}`).toBe(5);
    // ログと演出が1対1で対応していること（同じ絵で違う出来事を表さない）
    expect(new Set(seen.values()).size, '複数の当たりが同じ演出になっている').toBe(5);
  });

  it('ハズレでは盤面の演出を出さない（赤いフラッシュだけ）', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const state = createGame(seed * 13);
      state.player.inventory[0] = { itemId: 'scroll', count: 1 };
      useItem(state, 0);
      if (!state.log.some((e) => e.key === 'log.scrollCurse')) continue;
      checked += 1;
      expect(state.stageEvent?.turn, 'ハズレで当たりの演出が出ている').not.toBe(state.turn);
      expect(state.player.cursedOnTurn).toBe(state.turn);
    }
    expect(checked, 'ハズレを引けなかった').toBeGreaterThan(0);
  });

  it('巻物以外では盤面の演出が残らない', () => {
    const state = createGame(5);
    state.player.inventory[0] = { itemId: 'scroll', count: 2 };
    useItem(state, 0);
    const eventTurn = state.stageEvent?.turn;

    // ターンが進めば、前のターンの演出は出なくなる
    takeTurn(state, { type: 'wait' });
    if (eventTurn !== undefined) {
      expect(state.stageEvent?.turn).not.toBe(state.turn);
    }
  });
});
