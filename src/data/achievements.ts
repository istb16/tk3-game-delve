import type { AchievementId } from '../core/types';

/**
 * 実績の定義（docs/03 §3.9）。
 *
 * 判定に使えるのは「この Run の集計」と「累計」だけ。
 * ゲームの進行そのものを見に行かせないことで、実績がルールに干渉しないようにする。
 *
 * 深さを競うスコアに対して、Treasure Hunter と Slayer は逆に**浅い階を舐め尽くす**
 * プレイを促す。これは意図的な緊張で、「今回はスコアを狙うか実績を狙うか」という
 * Run ごとの目的の切り替えを生む（docs/03 §3.8）。
 */

export interface AchievementContext {
  /** この Run の到達最深階 */
  floor: number;
  /** この Run の撃破数 */
  kills: number;
  /** この Run のボス撃破数 */
  bossKills: number;
  /** この Run で開けた宝箱の数 */
  chestsOpened: number;
  /** 過去の Run を含む累計撃破数 */
  totalKills: number;
}

export interface AchievementDef {
  id: AchievementId;
  /** 解除条件。純粋な述語であること（状態を変えない） */
  test: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'firstBlood', test: (c) => c.kills >= 1 },
  { id: 'deepDiver', test: (c) => c.floor >= 5 },
  { id: 'treasureHunter', test: (c) => c.chestsOpened >= 10 },
  { id: 'slayer', test: (c) => c.kills >= 30 },
  { id: 'bossKiller', test: (c) => c.bossKills >= 1 },
  { id: 'centurion', test: (c) => c.totalKills >= 100 },
  { id: 'floor10', test: (c) => c.floor >= 10 },
  { id: 'floor25', test: (c) => c.floor >= 25 },
  { id: 'floor50', test: (c) => c.floor >= 50 },
];

export const ACHIEVEMENT_IDS: readonly AchievementId[] = ACHIEVEMENTS.map((a) => a.id);

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && (ACHIEVEMENT_IDS as readonly string[]).includes(value);
}
