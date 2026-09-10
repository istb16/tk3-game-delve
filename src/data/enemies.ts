import type { AbilityId, AiKind, EnemyKind } from '../core/types';

/**
 * 敵の定義テーブル。バランス調整はこのファイルだけを触る。
 * 数値の根拠は docs/03-game-design.md、深度カーブは docs/07-difficulty.md。
 */

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
  /**
   * この階層より浅いところには絶対に出さない（docs/03 §3.3 の「出現階」）。
   *
   * ガウス重みだけでは裾が浅い階まで伸びる。Phase 2 までは能力持ちが
   * プールから除外されていたため露見しなかったが、Phase 3 で全種を解禁した
   * 途端に **1階に Warden が湧いた**（TTK 23ターン / TTD 2.5ターンで手も足も出ない）。
   * 重み付けは「出やすさ」を決めるものであって、「出てよいか」は決められない。
   */
  minFloor: number;
  /** 出現の基礎重み */
  baseWeight: number;
  /** 最も出やすい階層 */
  peakFloor: number;
  /** 出現帯の広さ。大きいほど広い深度で見かける */
  spread: number;
  ability: AbilityId | null;
  /** 回避率（0..1）。攻撃が「当たらない」ことが持ち味の敵に使う。 */
  evasion: number;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    kind: 'rat',
    minFloor: 1,
    name: 'Rat',
    ai: 'swift',
    hp: 8, attack: 4, defense: 0, speed: 2,
    exp: 3, gold: 2,
    baseWeight: 5, peakFloor: 2, spread: 6,
    ability: null,
    evasion: 0,
  },
  {
    kind: 'goblin',
    minFloor: 1,
    name: 'Goblin',
    ai: 'chase',
    hp: 14, attack: 7, defense: 1, speed: 1,
    exp: 6, gold: 5,
    baseWeight: 5, peakFloor: 5, spread: 8,
    ability: null,
    evasion: 0,
  },
  {
    kind: 'bat',
    minFloor: 2,
    name: 'Bat',
    ai: 'erratic',
    hp: 10, attack: 6, defense: 0, speed: 2,
    exp: 8, gold: 4,
    // 出現の山を深めに寄せ、裾も狭める。速度2と回避の組み合わせは
    // レベル1のプレイヤーには重すぎる（実測で1〜4階の死亡が14%まで上がった）。
    baseWeight: 4, peakFloor: 9, spread: 6,
    ability: null,
    // ふらふら飛んで当たらない。硬さではなく「当たらなさ」で嫌らしくする。
    evasion: 0.12,
  },
  {
    kind: 'skeleton',
    minFloor: 3,
    name: 'Skeleton',
    ai: 'chase',
    hp: 26, attack: 8, defense: 4, speed: 1,
    exp: 12, gold: 9,
    // spread を狭めるのは、復活持ちが3〜4階に漏れると「倒しても起き上がる敵」が
    // レベル2の時点で壁になるため。出現階そのものは設計書どおり3階から。
    baseWeight: 3, peakFloor: 13, spread: 7,
    ability: 'revive',
    evasion: 0,
  },
  {
    kind: 'slime',
    minFloor: 4,
    name: 'Slime',
    ai: 'chase',
    hp: 18, attack: 6, defense: 2, speed: 1,
    exp: 10, gold: 6,
    baseWeight: 3, peakFloor: 16, spread: 8,
    ability: 'split',
    evasion: 0,
  },
  {
    kind: 'warden',
    minFloor: 7,
    name: 'Warden',
    ai: 'chase',
    hp: 45, attack: 14, defense: 6, speed: 1,
    exp: 30, gold: 25,
    baseWeight: 2, peakFloor: 26, spread: 14,
    ability: 'guard',
    evasion: 0,
  },
  {
    kind: 'boss',
    minFloor: 5,
    name: 'Warden Lord',
    ai: 'chase',
    // 通常の敵と同じ係数で伸ばすので、素の値は「floor 5 で成立する」ように置く。
    // 素で強い数値にすると、スケーリングが乗った瞬間に手も足も出なくなる
    // （検算: 旧値 90/20/8 は floor 5 で TTK 29ターン・TTD 2ターン、Margin 0.07）。
    // 防御を低く保つのが要点。高いとプレイヤーの攻撃が通らず TTK だけが伸びる。
    hp: 47, attack: 8, defense: 2, speed: 1,
    exp: 100, gold: 80,
    // 通常のプールには入れず、5の倍数階に個別配置する
    baseWeight: 0, peakFloor: 0, spread: 1,
    ability: 'boss',
    evasion: 0,
  },
];

/**
 * 通常スポーンの候補。ボスは階層で出現位置が決まるので除く（baseWeight 0）。
 * Phase 3 で全ての特殊能力を実装したため、能力による絞り込みはもう要らない。
 */
export const SPAWN_POOL: readonly EnemyDef[] = ENEMIES.filter((e) => e.baseWeight > 0);

export function bossDef(): EnemyDef {
  const boss = ENEMIES.find((e) => e.ability === 'boss');
  if (!boss) throw new Error('ボスが定義されていない');
  return boss;
}

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
  if (floor < def.minFloor) return 0;
  const z = (floor - def.peakFloor) / def.spread;
  return def.baseWeight * Math.exp(-(z * z));
}
