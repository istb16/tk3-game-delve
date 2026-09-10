/**
 * 全レイヤが共有する型定義。
 * ここは DOM を一切知らない - ui/ 以外から document/window を触らないための基点。
 */

import type { Rng } from './rng';

export type Vec2 = { x: number; y: number };

export type Dir = 'up' | 'down' | 'left' | 'right';

export type TileKind = 'wall' | 'floor' | 'stairs';

/** phase は「モーダル表示」と「移動入力を受け付けるか」を兼ねる。 */
export type Phase = 'playing' | 'choosing' | 'dead';

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

/**
 * 継続効果。毎ターンの終わりに 1 ずつ減り、0 で消える。
 *
 * 「今すぐ効く」ものは即座に適用すればよく、状態として持つ必要はない。
 * ここに入るのは**時間をまたいで効く**ものだけ。
 */
export type StatusKind = 'poison' | 'burn' | 'slow' | 'rage' | 'guard';

export interface StatusEffect {
  kind: StatusKind;
  /** 残りターン数 */
  turns: number;
  /** ダメージ量、または倍率。意味は kind ごとに決まる。 */
  power: number;
}

export interface Actor {
  id: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  effects: StatusEffect[];
  /**
   * 移動に成功した累積回数。UI が `steps % 2` を歩行フレーム番号として使う。
   * アニメーション状態を UI に持たせず、ゲーム状態から導出するための出典。
   */
  steps: number;
  /**
   * 最後にダメージを受けたターン番号。UI は `hurtOnTurn === state.turn` で
   * 被弾演出を出すかどうかを決める。
   *
   * これも `steps` と同じ考え方 — 「何が起きたか」はゲーム状態の事実として持ち、
   * 演出はそこから導出する。UI 側にフラグを置くと、演出が出る／出ないが
   * 再描画の都合で決まってしまう。
   */
  hurtOnTurn: number;
  /** 直近に受けたダメージ量。ダメージ表示に使う。 */
  lastDamage: number;
}

// --- アイテム ----------------------------------------------------------------

export type ItemId = 'potion' | 'elixir' | 'bomb' | 'scroll' | 'key';

export interface ItemStack {
  itemId: ItemId;
  count: number;
}

// --- 装備 --------------------------------------------------------------------

export type Slot = 'weapon' | 'armor' | 'ring';

export type EquipmentId =
  | 'rustyDagger' | 'ironSword' | 'flameBlade' | 'vampireFang' | 'assassinKris' | 'wardensMaul'
  | 'leatherVest' | 'chainMail' | 'thornPlate' | 'shadowCloak'
  | 'ringOfVigor' | 'ringOfFury' | 'ringOfFortune' | 'ringOfInsight';

export type Rarity = 'common' | 'rare' | 'epic';

/**
 * ステータス補正。装備とパークが共通で使う。
 * 加算（attack）と乗算（attackPct）を分け、乗算は加算をすべて足した後に掛ける。
 */
export interface StatMods {
  attack?: number;
  attackPct?: number;
  defense?: number;
  maxHp?: number;
  /** クリティカル率の加算（0..1） */
  crit?: number;
  /** 回避率の加算（0..1） */
  evasion?: number;
  /** 与ダメージのうち HP として吸収する割合（0..1） */
  lifesteal?: number;
  /** 被弾時に攻撃者へ返す固定ダメージ */
  thorns?: number;
  goldPct?: number;
  expPct?: number;
}

/** 装備の特殊効果。命中時に確率で発動する。 */
export type EffectId = 'burn' | 'slow';

export interface Equipment {
  id: EquipmentId;
  name: string;
  slot: Slot;
  rarity: Rarity;
  mods: StatMods;
  /** 命中時に確率で発動する効果。null なら効果なし。 */
  effect: EffectId | null;
  /** effect の発動率（0..1）。effect が null なら 0。 */
  effectChance: number;
}

// --- 実績 --------------------------------------------------------------------

export type AchievementId =
  | 'firstBlood'
  | 'deepDiver'
  | 'treasureHunter'
  | 'slayer'
  | 'bossKiller'
  | 'centurion'
  | 'floor10'
  | 'floor25'
  | 'floor50';

// --- パーク ------------------------------------------------------------------

export type PerkId =
  | 'sharpened' | 'vitality' | 'deadlyAim' | 'ironhide'
  | 'lifesteal' | 'treasureSense' | 'swiftStep'
  | 'poisonAttack' | 'fireDamage' | 'shield';

// --- 床のオブジェクト --------------------------------------------------------

export type EntityKind = 'item' | 'gold' | 'equipment' | 'chest' | 'event';

/** ランダムイベントの識別子（docs/03 §3.7） */
export type EventId =
  | 'shrine'
  | 'merchant'
  | 'cursedChest'
  | 'healingSpring'
  | 'strangeAltar'
  | 'hiddenRoom'
  | 'treasury';

/** payload を判別可能ユニオンにして、kind と中身の不整合を型で防ぐ。 */
export type EntityPayload =
  | { type: 'item'; itemId: ItemId; count: number }
  | { type: 'gold'; amount: number }
  | {
      type: 'equipment';
      equipment: Equipment;
      /**
       * この装備を「今のままでいい」と断ったときの、当時の装備の id。
       * 同じ比較を何度も聞き直さないための記録。装備が変わればもう一度尋ねる
       * （ビルドが変われば答えも変わるため）。
       */
      declinedAgainst: EquipmentId | null;
    }
  | { type: 'chest'; locked: boolean }
  | { type: 'event'; eventId: EventId };

export interface Entity {
  id: string;
  kind: EntityKind;
  pos: Vec2;
  payload: EntityPayload;
}

export interface Player extends Actor {
  level: number;
  exp: number;
  /** 最後にレベルが上がったターン番号。演出の判定に使う。 */
  leveledOnTurn: number;
  /**
   * HP 以外の負の効果を受けたターン番号（巻物の呪いなど）。
   *
   * `hurtOnTurn` と分けているのは、ダメージ数値を出すかどうかが違うから。
   * 呪いは HP を削らないので、数字を浮かせると「何のダメージ?」になる。
   * 赤いフラッシュだけを出して「悪いことが起きた」と伝える。
   */
  cursedOnTurn: number;
  /** 次のレベルまでに必要な累計経験値 */
  nextExp: number;
  gold: number;
  /** 固定長 INVENTORY_SIZE。null は空きスロット。 */
  inventory: (ItemStack | null)[];
  equipment: Record<Slot, Equipment | null>;
  /** 取得順。同じパークを重ねて取れる。 */
  perks: PerkId[];
  /**
   * イベントや巻物による恒久的な補正の累積。
   *
   * recalcStats はレベル・装備・パークから毎回ゼロで組み立て直すので、
   * それ以外の出所による変化はここに集約しないと次の再計算で消える。
   */
  bonuses: StatMods;
  /** Shield パークの残りクールダウン。0 なら次の被弾を無効化する。 */
  shieldCooldown: number;

  // --- 装備とパークから毎回引き直す派生値（progression.recalcStats が唯一の書き手） ---
  critChance: number;
  evasion: number;
  lifesteal: number;
  thorns: number;
  goldPct: number;
  expPct: number;
}

export type EnemyKind = 'rat' | 'goblin' | 'skeleton' | 'bat' | 'slime' | 'warden' | 'boss';

export type AiKind = 'chase' | 'swift' | 'erratic';

/** 敵の特殊能力（docs/03 §3.3） */
export type AbilityId = 'revive' | 'split' | 'guard' | 'boss';

export interface Enemy extends Actor {
  kind: EnemyKind;
  name: string;
  ai: AiKind;
  /** 1ターンあたりの行動回数 */
  speed: number;
  exp: number;
  gold: number;
  /** 回避率（0..1）。Bat のように「当たらない」ことが持ち味の敵に使う。 */
  evasion: number;
  ability: AbilityId | null;
  /** 一度きりの能力を使ったかどうか */
  revived: boolean;
  split: boolean;
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
  | 'log.died'
  | 'log.pickup'
  | 'log.inventoryFull'
  | 'log.usePotion'
  | 'log.useElixir'
  | 'log.emptySlot'
  | 'log.alreadyFull'
  | 'log.descendHeal'
  | 'log.critical'
  | 'log.evaded'
  | 'log.lifesteal'
  | 'log.thorns'
  | 'log.pickupGold'
  | 'log.openChest'
  | 'log.equip'
  | 'log.equipWorse'
  | 'log.useBomb'
  | 'log.bombDud'
  | 'log.perkTaken'
  | 'log.equipKept'
  | 'log.newBest'
  | 'log.poisoned'
  | 'log.burned'
  | 'log.slowed'
  | 'log.statusTick'
  | 'log.enemyEvaded'
  | 'log.guarded'
  | 'log.revived'
  | 'log.split'
  | 'log.enraged'
  | 'log.bossAppears'
  | 'log.shieldBlocked'
  | 'log.useScroll'
  | 'log.scrollBlast'
  | 'log.scrollReveal'
  | 'log.scrollTeleport'
  | 'log.scrollRage'
  | 'log.scrollBanish'
  | 'log.scrollCurse'
  | 'log.needKey'
  | 'log.useKey'
  | 'log.eventDeclined'
  | 'log.shrineBlessed'
  | 'log.merchantBought'
  | 'log.merchantPoor'
  | 'log.cursedReward'
  | 'log.cursedTrap'
  | 'log.springDrunk'
  | 'log.altarSwapped'
  | 'log.altarEmpty'
  | 'log.hiddenRoom'
  | 'log.treasuryTaken'
  | 'log.achievement'
  | 'log.dropped'
  | 'log.dropNoRoom';

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
  bossKills: number;
  goldEarned: number;
  deepestFloor: number;
  chestsOpened: number;
}

// --- 入力の意図 --------------------------------------------------------------

/**
 * UI は生の KeyboardEvent ではなく Intent に変換して game/ に渡す。
 * これでキーバインドやタッチ操作を game/ から切り離せる。
 */
export type Intent =
  | { type: 'move'; dir: Dir }
  | { type: 'wait' }
  | { type: 'useItem'; slot: number }
  | { type: 'dropItem'; slot: number }
  /** レベルアップ等の選択肢を選ぶ */
  | { type: 'choose'; index: number }
  | { type: 'restart' };

// --- 選択待ち ----------------------------------------------------------------

/**
 * レベルアップとランダムイベントは「選択肢を出して1つ選ばせる」という同じ形なので、
 * 1つの型にまとめて UI を共通化する。イベントは Phase 3。
 */
export type PendingChoice =
  | { kind: 'levelup'; level: number; options: PerkId[] }
  | {
      /**
       * ランダムイベントの選択。
       * 効果そのものは state に持たず eventId から引く — 状態は素のデータのままにする。
       */
      kind: 'event';
      eventId: EventId;
      entityId: string;
      /** 提示する選択肢の数。中身は data/events.ts が持つ。 */
      optionCount: number;
    }
  | {
      /**
       * 拾った装備が今の装備の上位互換でも下位互換でもないとき（トレードオフ）の選択。
       * 単一の順序で自動的に決めてしまうと、順位1位の装備以外が永久に使われなくなる。
       */
      kind: 'equipment';
      entityId: string;
      candidate: Equipment;
      current: Equipment;
    };

// --- ゲーム状態 --------------------------------------------------------------

export interface GameState {
  phase: Phase;
  /**
   * 経過ターン数。演出の「今このターンに起きたか」の判定に使う。
   * ターンの開始時に増やすので、そのターン中のダメージはすべて同じ番号になる。
   */
  turn: number;
  /** ターン処理中に使う乱数。フロア生成には fork した子 RNG を使う。 */
  rng: Rng;
  /** この Run の乱数シード。同じシードなら同じダンジョンが再現される。 */
  seed: number;
  floor: number;
  dungeon: Dungeon;
  player: Player;
  enemies: Enemy[];
  /** 現在フロアの床に落ちている物 */
  entities: Entity[];
  /**
   * 選択待ちの列。1ターンで複数回レベルアップすることがあるため配列で持つ。
   * 空でなく生存中なら phase は 'choosing' になり、先頭を表示する。
   */
  pendingChoices: PendingChoice[];
  log: LogEntry[];
  stats: RunStats;
}
