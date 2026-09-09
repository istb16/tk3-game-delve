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

/**
 * レベルアップ時の上昇量。
 *
 * defense だけ 0.5 なのは意図的。ダメージが減算式（攻撃 - 防御）なので、
 * 防御力の線形上昇はそのまま被ダメージの線形減少になり、+1/Lv だと
 * 「深く潜るほどプレイヤーが硬くなる」逆転が起きる（docs/07 §7.5）。
 */
export const LEVEL_UP_GAIN = {
  maxHp: 6,
  attack: 2,
  defense: 0.5,
} as const;

/**
 * レベルアップ時の回復量（最大HPに対する割合）。
 *
 * Phase 2 でポーションが入ったら 0.4 に下げる。全回復のままだと強力すぎる
 * 回復資源になり、「今使うか取っておくか」の判断が消えるため（docs/03 §3.1）。
 *
 * ただし Phase 1 には回復手段が他に一切存在しないため、ここを 0.4 にすると
 * HP が一方通行で減り続け、3階前後で必ず尽きる（実測値は docs/07 §7.8）。
 * ポーションが入るまでは全回復とする。
 */
export const LEVEL_UP_HEAL = 1.0;

/** インベントリのスロット数。数字キー 1-8 に対応する。 */
export const INVENTORY_SIZE = 8;

/**
 * 1スロットに積める上限。
 *
 * 上限がないと同じ種類のアイテムが1スロットに無限に積み上がり、
 * スロット数が持ち運び量の制限として機能しなくなる（満杯の判定も到達しなくなる）。
 * 「どこまで抱えて潜るか」を判断にするための上限（docs/03 §3.5）。
 */
export const MAX_STACK = 3;

/** ポーションの回復量（最大HPに対する割合） */
export const POTION_HEAL = 0.4;

/**
 * 階段を降りた時の回復量（最大HPに対する割合）。
 *
 * 「フロアを掃除して経験値を稼ぐか、傷が浅いうちに降りるか」の判断を作る。
 * 深度が上がっても割合は変えない — 敵の与ダメージだけが伸びるので、
 * 1回の降下で取り返せる被害の割合が自然に下がっていく（docs/07 §7.4 レバー4）。
 */
export const DESCEND_HEAL = 0.2;

/** 1フロアに落ちているポーションの数 */
export function potionsPerFloor(floor: number): number {
  // 深いほどわずかに増やすが、敵の伸びには追いつかせない。
  // 「1本で取り返せる被害の割合」が深度とともに下がっていくのが狙い。
  return floor >= 10 ? 3 : 2;
}

/** ダメージの下限。0 を許すと「まったく通らない」詰みが発生する。 */
export const MIN_DAMAGE = 1;

/**
 * フロアあたりの敵の数。
 *
 * 14階で上限10に到達し、そこから先はこのレバーが効かなくなるため、
 * 20階以降だけ上限を12に引き上げる。15x15 のグリッドではこれが密度の限界で、
 * これ以上増やすと移動そのものが成立しない（docs/07 §7.4 レバー2）。
 */
export function enemyCountFor(floor: number): number {
  return Math.min(3 + Math.floor(floor / 2), floor >= 20 ? 12 : 10);
}

/** 敵がプレイヤーを認識する距離。これより遠い敵は行動しない。 */
export const ENEMY_AGGRO_RANGE = 6;

/** スポーン時にプレイヤーから最低限離す距離（開幕即戦闘を防ぐ） */
export const SPAWN_MIN_DISTANCE = 4;

/**
 * レベル level から level+1 に必要な経験値。
 *
 * 係数 8（旧 10）。Phase 1 はレベルアップが唯一の恒久的な強化手段なので、
 * ここが遅いと「深く潜るほど相対的に弱くなる」だけになる。
 */
export function expToNextLevel(level: number): number {
  return (8 * level * (level + 1)) / 2;
}

/**
 * 階層による敵の強化倍率。HP / 攻撃力 / 防御力で係数を分ける。
 *
 * 防御力の係数を最も小さくするのが要点。減算式ダメージでは敵防御が伸びすぎると
 * TTK（倒すのに要するターン数）が発散し、「固いだけの敵を延々殴る」退屈な戦闘になる。
 *
 * この値は Phase 1（装備・パークなし）向け。プレイヤーの強さの源が増えたら
 * 必ず `node tools/difficulty-model.mjs` で再検算すること（docs/07 §7.3）。
 */
export function hpScale(floor: number): number {
  return 1 + (floor - 1) * 0.1;
}

export function atkScale(floor: number): number {
  return 1 + (floor - 1) * 0.07;
}

export function defScale(floor: number): number {
  return 1 + (floor - 1) * 0.04;
}
