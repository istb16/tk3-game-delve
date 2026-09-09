import type { AiKind, EnemyKind } from '../core/types';

/**
 * 敵の定義テーブル。バランス調整はこのファイルだけを触る。
 * 数値の根拠は docs/03-game-design.md を参照。
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
  /** この階層以降で出現する */
  minFloor: number;
  /** 出現の重み。大きいほど出やすい。 */
  weight: number;
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
    minFloor: 1, weight: 5, ability: null,
  },
  {
    kind: 'goblin',
    name: 'Goblin',
    ai: 'chase',
    hp: 14, attack: 7, defense: 1, speed: 1,
    exp: 6, gold: 5,
    minFloor: 1, weight: 5, ability: null,
  },
  {
    kind: 'bat',
    name: 'Bat',
    ai: 'erratic',
    hp: 10, attack: 6, defense: 0, speed: 2,
    exp: 8, gold: 4,
    minFloor: 2, weight: 4, ability: null,
  },
  {
    kind: 'skeleton',
    name: 'Skeleton',
    ai: 'chase',
    hp: 26, attack: 8, defense: 4, speed: 1,
    exp: 12, gold: 9,
    minFloor: 3, weight: 3, ability: 'revive',
  },
  {
    kind: 'slime',
    name: 'Slime',
    ai: 'chase',
    hp: 18, attack: 6, defense: 2, speed: 1,
    exp: 10, gold: 6,
    minFloor: 4, weight: 3, ability: 'split',
  },
  {
    kind: 'warden',
    name: 'Warden',
    ai: 'chase',
    hp: 45, attack: 14, defense: 6, speed: 1,
    exp: 30, gold: 25,
    minFloor: 7, weight: 2, ability: 'guard',
  },
  {
    kind: 'boss',
    name: 'Warden Lord',
    ai: 'chase',
    hp: 90, attack: 20, defense: 8, speed: 1,
    exp: 100, gold: 80,
    minFloor: 5, weight: 0, ability: 'boss',
  },
];

/**
 * 現在スポーン可能な敵。
 * 特殊能力が未実装のものを出すと「設計と挙動が違う敵」になってしまうため、
 * ability を持つ敵は実装されるまでプールに入れない（Phase 3 でこの絞り込みを外す）。
 */
export const SPAWN_POOL: readonly EnemyDef[] = ENEMIES.filter((e) => e.ability === null);

/** その階層で出現しうる敵を返す。 */
export function spawnableAt(floor: number): readonly EnemyDef[] {
  const candidates = SPAWN_POOL.filter((e) => e.minFloor <= floor);
  // 深い階でも最低1種は返す（テーブルの minFloor 設定ミスで空になるのを防ぐ）
  return candidates.length > 0 ? candidates : SPAWN_POOL.slice(0, 1);
}
