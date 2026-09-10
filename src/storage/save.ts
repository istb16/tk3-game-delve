import type { AchievementId, GameState } from '../core/types';
import { SCORE_WEIGHT } from '../core/constants';
import { ACHIEVEMENT_IDS, isAchievementId } from '../data/achievements';

/**
 * Run をまたいで残る記録。
 *
 * 設定（言語・方向キー）とはキーを分ける。設定はスキーマを変えても残したい一方、
 * 記録はスキーマが変わったら捨てても構わない。寿命が違うものを同じ入れ物に入れない。
 */
export interface SaveData {
  version: 1;
  bestDepth: number;
  bestScore: number;
  totalKills: number;
  totalRuns: number;
  /** 解除済みの実績。順序は解除順ではなく定義順に正規化する。 */
  achievements: AchievementId[];
}

const STORAGE_KEY = 'delve.save.v1';

export function emptySave(): SaveData {
  return {
    version: 1,
    bestDepth: 0,
    bestScore: 0,
    totalKills: 0,
    totalRuns: 0,
    achievements: [],
  };
}

/** スコア。深く潜ることを最大の評価軸に置く（docs/03 §3.8）。 */
export function computeScore(state: GameState): number {
  return (
    state.stats.deepestFloor * SCORE_WEIGHT.floor +
    state.stats.kills * SCORE_WEIGHT.kill +
    state.stats.goldEarned * SCORE_WEIGHT.gold +
    state.player.level * SCORE_WEIGHT.level
  );
}

export function loadSave(): SaveData {
  const fallback = emptySave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;

    const record = parsed as Record<string, unknown>;
    // バージョンが違えば黙って初期値に戻す。
    // 古い記録のせいでゲームが起動しない、という事態だけは避ける。
    if (record['version'] !== 1) return fallback;

    return {
      version: 1,
      bestDepth: nonNegativeInt(record['bestDepth']),
      bestScore: nonNegativeInt(record['bestScore']),
      totalKills: nonNegativeInt(record['totalKills']),
      totalRuns: nonNegativeInt(record['totalRuns']),
      // 実績は後から足したフィールド。古い記録には無いので空で埋める。
      // 知らない id が混じっていても捨てるだけにして、起動を止めない。
      achievements: normalizeAchievements(record['achievements']),
    };
  } catch {
    return fallback;
  }
}

function normalizeAchievements(value: unknown): AchievementId[] {
  if (!Array.isArray(value)) return [];
  const have = new Set(value.filter(isAchievementId));
  // 定義順に並べ直す。保存の順序に UI が依存しないようにする。
  return ACHIEVEMENT_IDS.filter((id) => have.has(id));
}

function nonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function persist(save: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // 保存できなくても続行する。記録はゲームの進行に必須ではない。
  }
}

export interface RunOutcome {
  save: SaveData;
  score: number;
  newBestDepth: boolean;
  newBestScore: boolean;
}

/** 解除済み実績を記録に足す。死亡を待たず、解除した瞬間に書く。 */
export function recordAchievements(previous: SaveData, unlocked: readonly AchievementId[]): SaveData {
  if (unlocked.length === 0) return previous;
  const have = new Set([...previous.achievements, ...unlocked]);
  const save: SaveData = { ...previous, achievements: ACHIEVEMENT_IDS.filter((id) => have.has(id)) };
  persist(save);
  return save;
}

/**
 * 1 Run の結果を記録に反映する。死亡時に一度だけ呼ぶ。
 * 毎ターン書き込まない — localStorage への書き込みは同期処理なので、
 * ターンごとに走らせると入力の応答を鈍らせる。
 */
export function recordRun(previous: SaveData, state: GameState): RunOutcome {
  const score = computeScore(state);
  const newBestDepth = state.stats.deepestFloor > previous.bestDepth;
  const newBestScore = score > previous.bestScore;

  const save: SaveData = {
    version: 1,
    bestDepth: Math.max(previous.bestDepth, state.stats.deepestFloor),
    bestScore: Math.max(previous.bestScore, score),
    totalKills: previous.totalKills + state.stats.kills,
    totalRuns: previous.totalRuns + 1,
    achievements: previous.achievements,
  };
  persist(save);
  return { save, score, newBestDepth, newBestScore };
}
