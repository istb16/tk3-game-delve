/**
 * 全レイヤが共有する型定義。
 * ここは DOM を一切知らない - ui/ 以外から document/window を触らないための基点。
 */

import type { Rng } from './rng';

export type Vec2 = { x: number; y: number };

export type Dir = 'up' | 'down' | 'left' | 'right';

export type TileKind = 'wall' | 'floor' | 'stairs';

/** phase は「モーダル表示」と「移動入力を受け付けるか」を兼ねる。 */
export type Phase = 'playing' | 'dead';

// --- ダンジョン --------------------------------------------------------------

export interface Dungeon {
  width: number;
  height: number;
  /** index = y * width + x。2次元配列より境界チェックを1箇所に集約できる。 */
  tiles: TileKind[];
  /** 一度でも視界に入ったか（フォグ用） */
  explored: boolean[];
  /** 現在見えているか */
  visible: boolean[];
  start: Vec2;
  stairs: Vec2;
}

// --- アクター ----------------------------------------------------------------

export interface Actor {
  id: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  /**
   * 移動に成功した累積回数。UI が `steps % 2` を歩行フレーム番号として使う。
   * アニメーション状態を UI に持たせず、ゲーム状態から導出するための出典。
   */
  steps: number;
}

export interface Player extends Actor {
  level: number;
  exp: number;
  /** 次のレベルまでに必要な累計経験値 */
  nextExp: number;
  gold: number;
}

export type EnemyKind = 'rat' | 'goblin' | 'skeleton' | 'bat' | 'slime' | 'warden' | 'boss';

export type AiKind = 'chase' | 'swift' | 'erratic';

export interface Enemy extends Actor {
  kind: EnemyKind;
  name: string;
  ai: AiKind;
  /** 1ターンあたりの行動回数 */
  speed: number;
  exp: number;
  gold: number;
}

// --- ログ --------------------------------------------------------------------

export type LogTone = 'info' | 'good' | 'bad' | 'gold' | 'system';

/**
 * ログのメッセージ識別子。
 *
 * game/ は完成した文章ではなく「何が起きたか」だけを積み、ui/ が表示言語に応じて
 * 文章に組み立てる。これで game/ が表示言語を知らずに済み、
 * 「ロジックは描画を知らない」という境界を保ったまま多言語化できる。
 */
export type LogKey =
  | 'log.welcome'
  | 'log.floor'
  | 'log.playerHit'
  | 'log.enemyHit'
  | 'log.enemyDies'
  | 'log.levelUp'
  | 'log.died';

export interface LogEntry {
  id: number;
  key: LogKey;
  params: Readonly<Record<string, string | number>>;
  tone: LogTone;
}

// --- Run 統計 ----------------------------------------------------------------

export interface RunStats {
  /** epoch ms */
  startedAt: number;
  kills: number;
  goldEarned: number;
  deepestFloor: number;
}

// --- 入力の意図 --------------------------------------------------------------

/**
 * UI は生の KeyboardEvent ではなく Intent に変換して game/ に渡す。
 * これでキーバインドやタッチ操作を game/ から切り離せる。
 */
export type Intent =
  | { type: 'move'; dir: Dir }
  | { type: 'wait' }
  | { type: 'restart' };

// --- ゲーム状態 --------------------------------------------------------------

export interface GameState {
  phase: Phase;
  /** ターン処理中に使う乱数。フロア生成には fork した子 RNG を使う。 */
  rng: Rng;
  /** この Run の乱数シード。同じシードなら同じダンジョンが再現される。 */
  seed: number;
  floor: number;
  dungeon: Dungeon;
  player: Player;
  enemies: Enemy[];
  log: LogEntry[];
  stats: RunStats;
}
