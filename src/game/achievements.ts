import type { AchievementId, GameState } from '../core/types';
import type { AchievementContext } from '../data/achievements';
import { ACHIEVEMENTS } from '../data/achievements';
import { addLog } from '../core/log';

/**
 * 実績の判定。
 *
 * 累計値は storage/ が持つので、ここには引数で渡してもらう。
 * game/ が保存の存在を知らずに済み、判定だけを単体で検証できる。
 */
export function evaluateAchievements(
  state: GameState,
  unlocked: readonly AchievementId[],
  previousTotalKills: number,
): AchievementId[] {
  const context: AchievementContext = {
    floor: state.stats.deepestFloor,
    kills: state.stats.kills,
    bossKills: state.stats.bossKills,
    chestsOpened: state.stats.chestsOpened,
    // 累計は「保存済み + 進行中の Run」。Run の途中でも 100 体目で解除されてほしい。
    totalKills: previousTotalKills + state.stats.kills,
  };

  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter((def) => !have.has(def.id) && def.test(context)).map((def) => def.id);
}

/** 解除をログに流す。演出は ui/ の仕事なので、ここでは事実だけを積む。 */
export function logAchievements(state: GameState, unlocked: readonly AchievementId[]): void {
  for (const id of unlocked) {
    addLog(state.log, 'log.achievement', { id }, 'system');
  }
}
