# 04. データモデル

型定義の正本は [`src/core/types.ts`](../src/core/types.ts)。本書はその意図と関係を説明する。

各フィールドには実装状況を示す印を付ける。

| 印 | 意味 |
|---|---|
| ✅ | 実装済み |
| 🔜 | 設計済み・未実装（フェーズ番号を併記） |

## 4.1 全体構造

```
GameState
├─ phase: Phase                     ✅ 画面・入力の受付状態
├─ rng: Rng                         ✅ ターン処理中に使う乱数
├─ seed: number                     ✅ このRunの乱数シード（再現用）
├─ floor: number                    ✅ 現在階層
├─ dungeon: Dungeon                 ✅ 現在フロアの地形
├─ player: Player                   ✅ プレイヤー
├─ enemies: Enemy[]                 ✅ 現在フロアの敵
├─ log: LogEntry[]                  ✅ メッセージログ（末尾が最新）
├─ stats: RunStats                  ✅ このRunの集計
├─ entities: Entity[]               🔜 P2 床に落ちている物
└─ pending: PendingChoice | null    🔜 P2 レベルアップ/イベントの選択待ち
```

表示設定（言語 / 方向キー）は `GameState` に入れない。Run が終わっても残る値であり、
ゲームの進行状態とは寿命が違うため、`Settings` として別に持つ（→ 4.11）。

`rng` を状態に持たせているのは、フロア生成に `rng.fork(floor)` で派生させた子 RNG を使うため。
ターン中の乱数消費がフロア生成結果に影響しないので、**同じシードなら常に同じフロアが出る**。

## 4.2 座標とタイル

座標は `{ x, y }`。原点は左上、`x` が右方向、`y` が下方向。

```ts
type Vec2 = { x: number; y: number };
type TileKind = 'wall' | 'floor' | 'stairs';
```

地形は `TileKind[]` の 1 次元配列で持ち、`index = y * width + x` で参照する。
2 次元配列より境界チェックが 1 箇所に集約でき、コピーも速い。

```ts
interface Dungeon {
  width: number;
  height: number;
  tiles: TileKind[];
  explored: boolean[];   // 視界に入ったことがあるか（フォグ用）
  visible: boolean[];    // 現在見えているか
  start: Vec2;
  stairs: Vec2;
}
```

範囲外アクセスは `tileAt()` が `'wall'` を返すことで吸収する。
境界チェックをこの 1 関数に集約し、呼び出し側から消す。

## 4.3 アクター

プレイヤーと敵は共通の基底を持つ。

```ts
interface Actor {
  id: string;             // ✅
  pos: Vec2;              // ✅
  hp: number;             // ✅
  maxHp: number;          // ✅
  attack: number;         // ✅
  defense: number;        // ✅
  steps: number;          // ✅ 移動に成功した累積回数
  effects: StatusEffect[];// 🔜 P3 毒 / 火傷 / 鈍足 など
}
```

### `steps` — 歩行アニメーションの出典

移動に成功するたびに +1 される単なる数値。UI 側は `steps % 2` を
スプライトのフレーム番号として使う（→ [05 §5.2](05-ui-design.md)）。

アニメーション状態を UI 側に持たせず、**ゲーム状態から導出する**ことで
「UI はゲーム状態を書き換えない」という境界（→ [02](02-architecture.md)）を保つ。
`steps` 自体は DOM を含まない純粋な数値なので、`game/` が持って問題ない。

### Player

```ts
interface Player extends Actor {
  level: number;      // ✅
  exp: number;        // ✅
  nextExp: number;    // ✅ 次のレベルまでに必要な経験値
  gold: number;       // ✅
  critChance: number; // 🔜 P2  0..1
  evasion: number;    // 🔜 P3  0..1
  lifesteal: number;  // 🔜 P2  0..1
  equipment: {        // 🔜 P2
    weapon: Equipment | null;
    armor: Equipment | null;
    ring: Equipment | null;
  };
  inventory: (ItemStack | null)[];  // 🔜 P2 固定長 8。null は空きスロット
  perks: PerkId[];                  // 🔜 P2 重複可。取得順に追加
}
```

**派生値の扱い**: `attack` などは「基礎値 + 装備 + パーク」の合成結果を**キャッシュした値**として持つ。
装備変更・パーク取得・レベルアップの各時点で `recalcStats(player)` を呼んで再計算する。
毎フレーム再計算しないのは、状態が変わるタイミングが離散的で明確だから。

### Enemy

```ts
interface Enemy extends Actor {
  kind: EnemyKind;    // ✅ 'rat' | 'goblin' | ...
  name: string;       // ✅
  ai: AiKind;         // ✅ 'chase' | 'swift' | 'erratic'
  speed: number;      // ✅ 1ターンあたりの行動回数
  exp: number;        // ✅
  gold: number;       // ✅
  flags: {            // 🔜 P3
    revived?: boolean;  // Skeleton の復活を使ったか
    split?: boolean;    // Slime が分裂済みか
    fleeing?: boolean;  // Goblin が逃走中か
  };
}
```

## 4.4 敵の定義テーブル

出現制御は `minFloor` / `maxFloor` による引退方式ではなく、
**深度のガウス分布による連続的な重み**で行う（理由は [07 §7.4](07-difficulty.md)）。

```ts
interface EnemyDef {
  kind: EnemyKind;
  name: string;
  ai: AiKind;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  exp: number;
  gold: number;
  baseWeight: number;   // 出現の基礎重み
  peakFloor: number;    // 最も出やすい階層
  spread: number;       // 出現帯の広さ
  ability: AbilityId | null;  // null 以外は未実装。SPAWN_POOL から除外される
}
```

> ✅ 実装済み（[`src/data/enemies.ts`](../src/data/enemies.ts)）。
> 十分に深いと全ての重みが 0 に潰れるため、その場合は `peakFloor` が最も深い敵に
> フォールバックする。深度に上限がない設計なので、この退避は必須。

## 4.5 床のオブジェクト 🔜 P2

```ts
type EntityKind = 'chest' | 'gold' | 'item' | 'equipment' | 'special';

interface Entity {
  id: string;
  kind: EntityKind;
  pos: Vec2;
  payload:
    | { type: 'gold'; amount: number }
    | { type: 'item'; itemId: ItemId; count: number }
    | { type: 'equipment'; equipment: Equipment }
    | { type: 'chest'; locked: boolean; opened: boolean }
    | { type: 'special'; eventId: EventId };
}
```

`payload` を判別可能ユニオンにすることで、`kind` と中身の不整合を型で防ぐ。

## 4.6 装備とアイテム 🔜 P2

```ts
type Slot = 'weapon' | 'armor' | 'ring';

interface EquipmentDef {
  id: EquipmentId;
  name: string;
  slot: Slot;
  minFloor: number;
  rarity: 'common' | 'rare' | 'epic';
  mods: StatMods;
  effect?: EffectId;
  effectChance?: number;
}

interface StatMods {
  attack?: number;
  attackPct?: number;
  defense?: number;
  maxHp?: number;
  crit?: number;
  evasion?: number;
  goldPct?: number;
  expPct?: number;
}

interface ItemStack {
  itemId: ItemId;   // 'potion' | 'bomb' | 'scroll' | 'key'
  count: number;
}
```

`Equipment`（実体）は当面 `EquipmentDef` のエイリアスから始め、
個体差が必要になった時点で拡張する。

## 4.7 ステータス効果 🔜 P3

```ts
interface StatusEffect {
  kind: 'poison' | 'burn' | 'slow' | 'rage' | 'shield';
  turns: number;   // 残りターン
  power: number;   // ダメージ量や倍率
}
```

毎ターン終了時に `turns` を減らし、0 で除去する。ダメージ系はその時点で適用する。

## 4.8 選択待ち状態 🔜 P2

レベルアップとランダムイベントは、どちらも「選択肢を出して 1 つ選ばせる」という同じ形。
UI を共通化するため 1 つの型にまとめる。

```ts
type PendingChoice =
  | { kind: 'levelup'; options: PerkId[] }
  | { kind: 'event'; eventId: EventId; options: EventOption[] };

interface EventOption {
  label: string;        // 'YES' / 'NO' など
  description: string;  // 効果の説明
  apply: (state: GameState) => void;
}
```

`pending !== null` の間は `phase` が `'levelup'` / `'event'` になり、移動入力を受け付けない。

## 4.9 スプライト定義

ドット絵は外部画像を使えないため、コード上のテキストとして持つ（→ [05 §5.3](05-ui-design.md)）。

```ts
interface SpriteDef {
  /** インデックス -> CSS 色。1スプライトあたり最大16色 */
  palette: readonly string[];
  /** frames[frameIndex][row] = 16文字の行。'.' は透明、'0'-'f' はパレット番号 */
  frames: readonly (readonly string[])[];
}
```

`game/` はスプライトを一切参照しない。`EnemyKind` から `SpriteDef` への対応付けは
`ui/` 側のテーブルが持つ。

## 4.9.1 ログ

`game/` は表示言語を知らないため、完成した文章ではなく識別子とパラメータを積む。
文章への組み立ては `ui/` が表示言語に応じて行う（→ [05 §5.14](05-ui-design.md)）。

```ts
export type LogKey =
  | 'log.welcome' | 'log.floor' | 'log.playerHit'
  | 'log.enemyHit' | 'log.enemyDies' | 'log.levelUp' | 'log.died';

interface LogEntry {
  id: number;
  key: LogKey;
  params: Readonly<Record<string, string | number>>;
  tone: LogTone;   // 'info' | 'good' | 'bad' | 'gold' | 'system'
}
```

## 4.10 Run 統計

```ts
interface RunStats {
  startedAt: number;    // ✅ epoch ms
  kills: number;        // ✅
  goldEarned: number;   // ✅
  deepestFloor: number; // ✅
  chestsOpened: number; // 🔜 P2
}
```

死亡時にリザルト画面へ渡し、スコアを計算して `SaveData` に反映する。

## 4.11 永続化

localStorage は用途ごとにキーを分ける。設定はゲームの進行と寿命が違う
（Run をまたいでも、スキーマを変えても残したい）ため、同じ入れ物に入れない。

### 設定 ✅ `delve.settings.v1`

```ts
export type Lang = 'en' | 'ja';
export type DpadMode = 'auto' | 'on' | 'off';

interface Settings {
  lang: Lang;
  dpad: DpadMode;
}
```

`lang` の初期値は `navigator.language` から推定する。`dpad` の初期値は `'auto'`。

**読み込みは常に既知の値だけを受け入れる。** 手で書き換えられた localStorage で
未定義の状態に落ちないようにするため、`LANGS.find(v => v === record.lang) ?? 既定値`
のように照合してから採用する。

### 記録 🔜 P2 `delve.save.v1`

バージョンをキー名に含めることで、スキーマ変更時に旧データを壊さず無視できる。

```ts
interface SaveData {
  version: 1;
  bestDepth: number;
  bestScore: number;
  totalKills: number;
  totalRuns: number;
  achievements: AchievementId[];
  settings: Settings;
}

interface Settings {
  sound: boolean;   // デフォルト false
}
```

### 読み込み時の方針

- パース失敗、または `version` 不一致の場合は **黙って初期値にフォールバック**する。
  localStorage の破損でゲームが起動しない事態を避ける。
- 書き込みは死亡時・実績解除時・設定変更時のみ。毎ターン書かない。
- localStorage が使えない環境（プライベートモード等）では例外を握りつぶし、
  メモリ上の値だけで動作を継続する。

## 4.12 乱数

```ts
interface Rng {
  next(): number;                       // [0, 1)
  int(min: number, max: number): number; // [min, max)
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  shuffle<T>(items: T[]): T[];
  fork(salt: number): Rng;
  readonly seed: number;
}
```

`GameState.seed` から `mulberry32` で生成する。フロア生成には `rng.fork(floor)` で
派生させた子 RNG を使い、同じシードなら常に同じフロアが出るようにする。

**`Math.random()` の直接使用は禁止**（例外は新しい Run のシード生成のみ）。
再現性はデバッグの生命線であり、[08](08-verification.md) の決定性テストの前提でもある。
