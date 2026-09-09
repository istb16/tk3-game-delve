import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/state';

/**
 * 永続化は「壊れていても必ず起動する」ことが最優先。
 * localStorage は Node には存在しないので、テストごとに差し替える。
 */
function installStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
  return store;
}

/** 読み書きが例外を投げる環境（プライベートモード等）を再現する。 */
function installBrokenStorage(): void {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('access denied');
    },
    setItem: () => {
      throw new Error('access denied');
    },
  });
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('設定の永続化', () => {
  it('保存した値が復元される', async () => {
    const { loadSettings, saveSettings } = await import('../src/storage/settings');
    saveSettings({ lang: 'ja', dpad: 'on' });
    expect(loadSettings()).toEqual({ lang: 'ja', dpad: 'on' });
  });

  it('壊れた JSON でも既定値で起動する', async () => {
    installStorage({ 'delve.settings.v1': '{"lang":"ja",' });
    const { loadSettings } = await import('../src/storage/settings');
    expect(loadSettings().dpad).toBe('auto');
  });

  it('未知の値は採用しない', async () => {
    installStorage({ 'delve.settings.v1': '{"lang":"klingon","dpad":"maybe"}' });
    const { loadSettings } = await import('../src/storage/settings');
    const settings = loadSettings();
    expect(['en', 'ja']).toContain(settings.lang);
    expect(settings.dpad).toBe('auto');
  });

  it('localStorage が使えなくても例外を投げない', async () => {
    installBrokenStorage();
    const { loadSettings, saveSettings } = await import('../src/storage/settings');
    expect(() => loadSettings()).not.toThrow();
    expect(() => saveSettings({ lang: 'en', dpad: 'off' })).not.toThrow();
  });
});

describe('記録の永続化', () => {
  it('スコアが定義どおりに計算される', async () => {
    const { computeScore } = await import('../src/storage/save');
    const { SCORE_WEIGHT } = await import('../src/core/constants');
    const state = createGame(1);
    state.stats.deepestFloor = 7;
    state.stats.kills = 11;
    state.stats.goldEarned = 130;
    state.player.level = 5;

    expect(computeScore(state)).toBe(
      7 * SCORE_WEIGHT.floor + 11 * SCORE_WEIGHT.kill + 130 * SCORE_WEIGHT.gold + 5 * SCORE_WEIGHT.level,
    );
  });

  it('ベスト記録は下がらず、累計は積み上がる', async () => {
    const { emptySave, recordRun } = await import('../src/storage/save');

    const deep = createGame(2);
    deep.stats.deepestFloor = 12;
    deep.stats.kills = 30;
    const first = recordRun(emptySave(), deep);
    expect(first.newBestDepth).toBe(true);

    const shallow = createGame(3);
    shallow.stats.deepestFloor = 3;
    shallow.stats.kills = 4;
    const second = recordRun(first.save, shallow);

    expect(second.newBestDepth).toBe(false);
    expect(second.save.bestDepth).toBe(12);
    expect(second.save.bestScore).toBe(first.save.bestScore);
    expect(second.save.totalKills).toBe(34);
    expect(second.save.totalRuns).toBe(2);
  });

  it('バージョンが違う記録は無視される', async () => {
    installStorage({ 'delve.save.v1': '{"version":99,"bestDepth":50,"bestScore":99999}' });
    const { loadSave } = await import('../src/storage/save');
    expect(loadSave().bestDepth).toBe(0);
  });

  it('負の値や壊れた値は 0 に丸める', async () => {
    installStorage({
      'delve.save.v1': '{"version":1,"bestDepth":-5,"bestScore":"nope","totalKills":null,"totalRuns":2.7}',
    });
    const { loadSave } = await import('../src/storage/save');
    const save = loadSave();
    expect(save.bestDepth).toBe(0);
    expect(save.bestScore).toBe(0);
    expect(save.totalKills).toBe(0);
    expect(save.totalRuns).toBe(2);
  });

  it('localStorage が使えなくても記録処理が落ちない', async () => {
    installBrokenStorage();
    const { emptySave, recordRun } = await import('../src/storage/save');
    const state = createGame(4);
    expect(() => recordRun(emptySave(), state)).not.toThrow();
  });
});
