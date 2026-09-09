import type { AiKind, EnemyKind } from '../core/types';

/**
 * 敵の定義テーブル。バランス調整はこのファイルだけを触る。
 * 数値の根拠は docs/03-game-design.md、深度カーブは docs/07-difficulty.md。
 */

/** 特殊能力の識別子。Phase 3 で combat/enemy 側に実装する。 */
export type AbilityId = 'revive' | 'split' | 'guard' | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  ai: AiKind;
  hp: number;
  attack: number;
  defense: number;
  /** 1ターンあたりの行動回数 */
  speed: number;
  exp: number;
  gold: number;
  /** 出現の基礎重み */
  baseWeight: number;
  /** 最も出やすい階層 */
  peakFloor: number;
  /** 出現帯の広さ。大きいほど広い深度で見かける */
  spread: number;
  /** null 以外はまだ未実装。SPAWN_POOL から除外される。 */
  ability: AbilityId | null;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    kind: 'rat',
    name: 'Rat',
    ai: 'swift',
    hp: 8, attack: 4, defense: 0, speed: 2,
    exp: 3, gold: 2,
    baseWeight: 5, peakFloor: 2, spread: 6,
    ability: null,
  },
  {
    kind: 'goblin',
    name: 'Goblin',
    ai: 'chase',
    hp: 14, attack: 7, defense: 1, speed: 1,
    exp: 6, gold: 5,
    baseWeight: 5, peakFloor: 5, spread: 8,
    ability: null,
  },
  {
    kind: 'bat',
    name: 'Bat',
    ai: 'erratic',
    hp: 10, attack: 6, defense: 0, speed: 2,
    exp: 8, gold: 4,
    baseWeight: 4, peakFloor: 8, spread: 8,
    ability: null,
  },
  {
    kind: 'skeleton',
    name: 'Skeleton',
    ai: 'chase',
    hp: 26, attack: 8, defense: 4, speed: 1,
    exp: 12, gold: 9,
    baseWeight: 3, peakFloor: 13, spread: 10,
    ability: 'revive',
  },
  {
    kind: 'slime',
    name: 'Slime',
    ai: 'chase',
    hp: 18, attack: 6, defense: 2, speed: 1,
    exp: 10, gold: 6,
    baseWeight: 3, peakFloor: 16, spread: 10,
    ability: 'split',
  },
  {
    kind: 'warden',
    name: 'Warden',
    ai: 'chase',
    hp: 45, attack: 14, defense: 6, speed: 1,
    exp: 30, gold: 25,
    baseWeight: 2, peakFloor: 26, spread: 14,
    ability: 'guard',
  },
  {
    kind: 'boss',
    name: 'Warden Lord',
    ai: 'chase',
    hp: 90, attack: 20, defense: 8, speed: 1,
    exp: 100, gold: 80,
    // 通常のプールには入れず、5の倍数階に個別配置する
    baseWeight: 0, peakFloor: 0, spread: 1,
    ability: 'boss',
  },
];

/**
 * 現在スポーン可能な敵。
 * 特殊能力が未実装のものを出すと「設計と挙動が違う敵」になってしまうため、
 * ability を持つ敵は実装されるまでプールに入れない（Phase 3 でこの絞り込みを外す）。
 */
export const SPAWN_POOL: readonly EnemyDef[] = ENEMIES.filter(
  (e) => e.ability === null && e.baseWeight > 0,
);

/**
 * その階層での出現重み。深度のガウス分布で連続的にずらす。
 *
 * 「minFloor を超えたら出現」「maxFloor を超えたら引退」という方式は、
 * その階を境に敵構成が一変して難易度に段差を作る。ガウス方式なら
 * 弱い敵は消えるのではなく滑らかに見かけなくなる（docs/07 §7.4 レバー3）。
 *
 * 使用時に正規化するため、どれだけ深くても比率は必ず求まる（深度に上限がない）。
 */
export function spawnWeight(def: EnemyDef, floor: number): number {
  const z = (floor - def.peakFloor) / def.spread;
  return def.baseWeight * Math.exp(-(z * z));
}
