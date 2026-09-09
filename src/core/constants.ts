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
 * 全回復にすると強力すぎる回復資源になり、ポーションの価値と
 * 「今使うか取っておくか」の判断が消える（docs/03 §3.1）。
 * Phase 1 は回復手段が他になかったため全回復にしていたが、
 * Phase 2 でポーション・爆弾・宝箱が入ったので設計値どおりに戻す。
 */
export const LEVEL_UP_HEAL = 0.4;

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

/** 1フロアに置く宝箱・ゴールドの数 */
export function chestsPerFloor(roll: number): number {
  return 1 + Math.floor(roll * 2); // 1..2
}

export function goldPilesPerFloor(roll: number): number {
  return 2 + Math.floor(roll * 3); // 2..4
}

/** 装備が落ちている確率。深いほど上がるが 0.8 で頭打ち。 */
export function equipmentDropChance(floor: number): number {
  return Math.min(0.35 + floor * 0.02, 0.8);
}

/** ゴールドの1山あたりの量 */
export function goldPileAmount(floor: number, roll: number): number {
  return Math.floor((5 + roll * 10) * (1 + (floor - 1) * 0.15));
}

/** レベルアップ時に提示するパークの数 */
export const PERK_CHOICES = 3;

/** プレイヤーのクリティカル基礎率。敵は 0（docs/03 §3.2）。 */
export const BASE_CRIT = 0.05;

/** クリティカル時のダメージ倍率 */
export const CRIT_MULTIPLIER = 1.8;

/** 爆弾の威力と、壁を壊す範囲（チェビシェフ距離） */
export const BOMB_DAMAGE = 20;
export const BOMB_RADIUS = 1;

/** スコアの重み（docs/03 §3.8） */
export const SCORE_WEIGHT = {
  floor: 1000,
  kill: 50,
  gold: 1,
  level: 200,
} as const;

/** Swift Step: 移動がターンを消費しない確率 */
export const SWIFT_STEP_CHANCE = 0.25;

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
 * HP と攻撃力に二次の項を入れているのは、装備とパークでプレイヤーの伸びが
 * 加速するため。線形だけで合わせると、序盤が厳しく深部が緩いという逆S字になる
 * （実測では中央値9・最深42階まで散った）。
 *
 * この値は Phase 2（装備・パークあり）向け。プレイヤーの強さの源が増えたら
 * 必ず再検算すること（docs/07 §7.3）。Phase 1 の値（0.10 / 0.07 / 0.04）のままだと、
 * 防具と Ironhide でプレイヤーの防御力が敵の攻撃力を追い越し、
 * 被ダメージが下限 1 に張り付いて事実上不死になる。
 */
export function hpScale(floor: number): number {
  const d = floor - 1;
  return 1 + d * 0.19 + d * d * 0.011;
}

export function atkScale(floor: number): number {
  const d = floor - 1;
  return 1 + d * 0.11 + d * d * 0.007;
}

export function defScale(floor: number): number {
  return 1 + (floor - 1) * 0.05;
}
