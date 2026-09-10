import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENT_IDS, ACHIEVEMENTS } from '../src/data/achievements';
import { createGame } from '../src/game/state';
import { evaluateAchievements } from '../src/game/achievements';

function installStorage(initial: Record<string, string> = {}): void {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

beforeEach(() => installStorage());
afterEach(() => vi.unstubAllGlobals());

describe('実績の判定', () => {
  it('条件を満たしていなければ何も解除されない', () => {
    const state = createGame(1);
    expect(evaluateAchievements(state, [], 0)).toEqual([]);
  });

  it('一度解除したものは二度と返さない', () => {
    const state = createGame(2);
    state.stats.kills = 1;

    const first = evaluateAchievements(state, [], 0);
    expect(first).toContain('firstBlood');

    const second = evaluateAchievements(state, first, 0);
    expect(second).not.toContain('firstBlood');
  });

  it('累計は保存済みと進行中の Run を合わせて見る', () => {
    const state = createGame(3);
    state.stats.kills = 1;

    // 累計99 + 今回1 = 100 で解除されてほしい（死亡を待たせない）
    expect(evaluateAchievements(state, [], 99)).toContain('centurion');
    expect(evaluateAchievements(state, [], 98)).not.toContain('centurion');
  });

  it('深さの実績は到達最深階で判定する（現在階ではない）', () => {
    const state = createGame(4);
    state.floor = 1;
    state.stats.deepestFloor = 10;

    const unlocked = evaluateAchievements(state, [], 0);
    expect(unlocked).toContain('deepDiver');
    expect(unlocked).toContain('floor10');
    expect(unlocked).not.toContain('floor25');
  });

  it('Run 単位の実績は Run の集計で判定する', () => {
    const state = createGame(5);
    state.stats.chestsOpened = 10;
    state.stats.kills = 30;
    state.stats.bossKills = 1;

    const unlocked = evaluateAchievements(state, [], 0);
    expect(unlocked).toContain('treasureHunter');
    expect(unlocked).toContain('slayer');
    expect(unlocked).toContain('bossKiller');
  });

  it('判定は状態を変えない（純粋な述語である）', () => {
    const state = createGame(6);
    state.stats.kills = 50;
    state.stats.deepestFloor = 30;
    const snapshot = JSON.stringify({ stats: state.stats, player: state.player });

    evaluateAchievements(state, [], 500);

    expect(JSON.stringify({ stats: state.stats, player: state.player })).toBe(snapshot);
  });

  it('定義に重複がなく、全 id が揃っている', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
    expect(ACHIEVEMENTS.length).toBe(9);
  });
});

describe('実績の永続化', () => {
  it('解除した瞬間に保存され、次回の起動で復元される', async () => {
    const { emptySave, loadSave, recordAchievements } = await import('../src/storage/save');

    const save = recordAchievements(emptySave(), ['firstBlood', 'deepDiver']);
    expect(save.achievements).toEqual(['firstBlood', 'deepDiver']);
    expect(loadSave().achievements).toEqual(['firstBlood', 'deepDiver']);
  });

  it('Run の記録を書いても実績は消えない', async () => {
    const { emptySave, recordAchievements, recordRun } = await import('../src/storage/save');
    const state = createGame(7);

    const withAch = recordAchievements(emptySave(), ['bossKiller']);
    const after = recordRun(withAch, state);

    expect(after.save.achievements).toEqual(['bossKiller']);
  });

  it('保存順に依らず定義順に正規化される', async () => {
    const { emptySave, recordAchievements } = await import('../src/storage/save');
    const save = recordAchievements(emptySave(), ['floor25', 'firstBlood']);
    expect(save.achievements).toEqual(['firstBlood', 'floor25']);
  });

  it('知らない実績 id が保存されていても捨てるだけで起動する', async () => {
    installStorage({
      'delve.save.v1':
        '{"version":1,"bestDepth":3,"achievements":["firstBlood","nonsense",42,null]}',
    });
    const { loadSave } = await import('../src/storage/save');
    const save = loadSave();

    expect(save.achievements).toEqual(['firstBlood']);
    expect(save.bestDepth).toBe(3);
  });

  it('実績フィールドが無い古い記録も読める', async () => {
    installStorage({ 'delve.save.v1': '{"version":1,"bestDepth":7,"bestScore":1234}' });
    const { loadSave } = await import('../src/storage/save');
    const save = loadSave();

    expect(save.achievements).toEqual([]);
    expect(save.bestDepth).toBe(7);
  });
});
