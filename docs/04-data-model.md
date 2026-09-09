# 04. データモデル

型定義の正本は [`src/core/types.ts`](../src/core/types.ts)。本書はその意図と関係を説明する。

## 4.1 全体構造

```
GameState
├─ phase: Phase                    画面・入力の受付状態
├─ seed: number                    このRunの乱数シード（再現用）
├─ floor: number                   現在階層
├─ dungeon: Dungeon                現在フロアの地形
├─ player: Player                  プレイヤー
├─ enemies: Enemy[]                現在フロアの敵
├─ entities: Entity[]              床に落ちている物（宝箱/金貨/装備/アイテム）
├─ log: LogEntry[]                 メッセージログ（末尾が最新）
├─ stats: RunStats                 このRunの集計
├─ pending: PendingChoice | null    レベルアップ/イベントの選択待ち
└─ settings: Settings              サウンド等
```

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

## 4.3 アクター

プレイヤーと敵は共通の基底を持つ。

```ts
interface Actor {
  id: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  effects: StatusEffect[];   // 毒 / 火傷 / 鈍足 など
}
```

### Player

```ts
interface Player extends Actor {
  level: number;
  exp: number;
  gold: number;
  critChance: number;        // 0..1
  evasion: number;           // 0..1
  lifesteal: number;         // 0..1
  equipment: {
    weapon: Equipment | null;
    armor: Equipment | null;
    ring: Equipment | null;
  };
  inventory: (ItemStack | null)[];  // 固定長 8。null は空きスロット
  perks: PerkId[];                  // 重複可。取得順に追加
}
```

**派生値の扱い**: `attack` などは「基礎値 + 装備 + パーク」の合成結果をキャッシュした値として持つ。
装備変更・パーク取得・レベルアップの各時点で `recalcStats(player)` を呼んで再計算する。
毎フレーム再計算しないのは、状態変化のタイミングが離散的で明確だから。

### Enemy

```ts
interface Enemy extends Actor {
  kind: EnemyKind;           // 'rat' | 'goblin' | ...
  ai: AiKind;                // 'chase' | 'swift' | 'erratic'
  speed: number;             // 1ターンあたりの行動回数
  exp: number;
  gold: number;
  flags: {
    revived?: boolean;       // Skeleton の復活を使ったか
    split?: boolean;         // Slime が分裂済みか
    fleeing?: boolean;       // Goblin が逃走中か
  };
}
```

## 4.4 床のオブジェクト

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

## 4.5 装備とアイテム

```ts
type Slot = 'weapon' | 'armor' | 'ring';

interface EquipmentDef {
  id: EquipmentId;
  name: string;
  slot: Slot;
  minFloor: number;          // これ以降の階層で出現
  rarity: 'common' | 'rare' | 'epic';
  mods: StatMods;            // 加算・乗算のステータス補正
  effect?: EffectId;         // 特殊効果（burn / lifesteal など）
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
```

`Equipment`（実体）は `EquipmentDef` への参照 + 個体差（あれば）で構成する。
現状は個体差を持たないため `Equipment = EquipmentDef` のエイリアスから始め、
必要になった時点で拡張する。

```ts
interface ItemStack {
  itemId: ItemId;            // 'potion' | 'bomb' | 'scroll' | 'key'
  count: number;
}
```

## 4.6 ステータス効果

```ts
interface StatusEffect {
  kind: 'poison' | 'burn' | 'slow' | 'rage' | 'shield';
  turns: number;             // 残りターン
  power: number;             // ダメージ量や倍率
}
```

毎ターン終了時に `turns` を減らし、0 で除去する。ダメージ系はその時点で適用する。

## 4.7 選択待ち状態

レベルアップとランダムイベントは、どちらも「選択肢を出して 1 つ選ばせる」という同じ形をしている。
UI を共通化するため 1 つの型にまとめる。

```ts
type PendingChoice =
  | { kind: 'levelup'; options: PerkId[] }
  | { kind: 'event'; eventId: EventId; options: EventOption[] };

interface EventOption {
  label: string;             // 'YES' / 'NO' など
  description: string;       // 効果の説明
  apply: (state: GameState) => void;
}
```

## 4.8 Run 統計

```ts
interface RunStats {
  startedAt: number;         // epoch ms
  kills: number;
  chestsOpened: number;
  goldEarned: number;
  deepestFloor: number;
}
```

死亡時にリザルト画面へ渡し、`score` を計算して `SaveData` へ反映する。

## 4.9 セーブデータ

localStorage キー: `delve.save.v1`

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
  sound: boolean;            // デフォルト false
}
```

### 読み込み時の方針

- パースに失敗、または `version` が一致しない場合は **黙って初期値にフォールバック**する。
  localStorage の破損でゲームが起動しない事態を避ける。
- 書き込みは死亡時・実績解除時・設定変更時のみ。毎ターン書かない。
- localStorage が使えない環境（プライベートモード等）では例外を握りつぶし、
  メモリ上の値だけで動作を継続する。

## 4.10 乱数

```ts
interface Rng {
  next(): number;                        // [0, 1)
  int(minInclusive, maxExclusive): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly [T, number][]): T;
  chance(p: number): boolean;
  shuffle<T>(items: T[]): T[];
}
```

`GameState.seed` から `mulberry32` で生成する。フロア生成には `seed + floor` から派生させた
子 RNG を使い、同じシードなら常に同じフロアが出るようにする（バグ再現とデバッグのため）。
