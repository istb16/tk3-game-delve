/** ゲーム全体の定数。バランス数値のうち「テーブル化するほどでない」ものだけを置く。 */

export const GRID_SIZE = 15;

/** プレイヤーから見えるチェビシェフ距離 */
export const VIEW_RADIUS = 6;

/** ログの保持件数。古いものから捨てる。 */
export const MAX_LOG = 60;

/** ボスが出現する階層の間隔（5, 10, 15, ...） */
export const BOSS_INTERVAL = 5;

/** プレイヤー初期値 */
export const PLAYER_BASE = {
  maxHp: 30,
  attack: 8,
  defense: 2,
} as const;

/** レベルアップ時の上昇量 */
export const LEVEL_UP_GAIN = {
  maxHp: 6,
  attack: 2,
  defense: 1,
} as const;

/** ダメージの下限。0 を許すと「まったく通らない」詰みが発生する。 */
export const MIN_DAMAGE = 1;

/** フロアあたりの敵の数の上限 */
export const MAX_ENEMIES_PER_FLOOR = 10;

/** 敵がプレイヤーを認識する距離。これより遠い敵は行動しない。 */
export const ENEMY_AGGRO_RANGE = 6;

/** スポーン時にプレイヤーから最低限離す距離（開幕即戦闘を防ぐ） */
export const SPAWN_MIN_DISTANCE = 4;

/** レベル level から level+1 に必要な累計経験値 */
export function expToNextLevel(level: number): number {
  return (10 * level * (level + 1)) / 2;
}

/** 階層による敵の強化倍率 */
export function floorScale(floor: number): number {
  return 1 + (floor - 1) * 0.12;
}
