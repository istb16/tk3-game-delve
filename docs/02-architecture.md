# 02. アーキテクチャ設計

## 2.1 設計原則

1. **ロジックは DOM を知らない** — `src/game/` と `src/core/` は `document` / `window` を参照しない。
   状態遷移が純粋関数に近い形で完結するため、挙動をコンソールやテストから直接検証できる。
2. **描画は状態の写像** — `src/ui/` は `GameState` を読んで描画するだけ。UI がゲーム状態を書き換えない。
   入力は「意図（Intent）」に変換して `game` 層へ渡す。
3. **データ駆動** — 敵・装備・アイテム・パークの定義は `src/data/` のテーブル。
   バランス調整でロジックに触らない。
4. **乱数は一元管理** — `Math.random()` を直接使わず `src/core/rng.ts` の seeded RNG を通す。
   同じシードで同じダンジョンが再現でき、バグの再現性を確保できる。

## 2.2 レイヤ構成

```
┌─────────────────────────────────────────────┐
│  ui/           描画・入力・演出（DOM / SVG）  │
│  audio/        Web Audio による効果音         │
├─────────────────────────────────────────────┤
│              ▲ 状態を読む   ▼ Intent を渡す   │
├─────────────────────────────────────────────┤
│  game/         ゲームルール（状態遷移）        │
│                dungeon / turn / combat / ... │
├─────────────────────────────────────────────┤
│  data/         静的定義テーブル                │
│  core/         型・定数・RNG・イベントバス      │
│  storage/      localStorage 永続化            │
└─────────────────────────────────────────────┘
```

依存の向きは常に **上 → 下**。`core` は誰にも依存しない。`game` は `core` と `data` にのみ依存する。

## 2.3 ディレクトリ構成

```
tk3-game-delve/
├─ index.html            開発用エントリ（ビルド時に単一ファイル化）
├─ vite.config.ts        単一チャンク出力の設定
├─ build/inline.mjs      JS/CSS を HTML に埋め込む後処理
├─ docs/                 設計書
└─ src/
   ├─ main.ts            起動・ゲームループ配線
   ├─ core/
   │  ├─ types.ts        全レイヤ共有の型定義
   │  ├─ constants.ts    グリッドサイズ等の定数
   │  ├─ rng.ts          seeded 乱数（mulberry32）
   │  └─ log.ts          メッセージログ
   ├─ game/
   │  ├─ state.ts        GameState の生成・遷移の入口
   │  ├─ dungeon.ts      ダンジョン生成（→ 06）
   │  ├─ player.ts       プレイヤー生成・成長・装備
   │  ├─ enemy.ts        敵の生成と AI
   │  ├─ combat.ts       ダメージ計算・撃破処理
   │  ├─ turn.ts         ターン進行
   │  ├─ loot.ts         ドロップ抽選・拾得
   │  └─ progression.ts  経験値・レベルアップ・パーク
   ├─ data/
   │  ├─ enemies.ts      敵テーブル
   │  ├─ equipment.ts    装備テーブル
   │  ├─ items.ts        アイテムテーブル
   │  ├─ perks.ts        パークテーブル
   │  └─ achievements.ts 実績テーブル
   ├─ ui/
   │  ├─ view.ts         ルート描画
   │  ├─ hud.ts          ステータス表示
   │  ├─ board.ts        ダンジョン描画
   │  ├─ panels.ts       装備 / スキル / アイテム
   │  ├─ logview.ts      ログ表示
   │  ├─ modal.ts        イベント / レベルアップ / リザルト
   │  ├─ sprites.ts      インライン SVG 定義
   │  └─ input.ts        キーボード / マウス / タッチ
   ├─ audio/sfx.ts       Web Audio 効果音
   ├─ storage/save.ts    localStorage 読み書き
   └─ styles/main.css    スタイル
```

## 2.4 ターンループ

ゲームは **入力駆動**。プレイヤーの入力があるまで一切の状態は進まない（`requestAnimationFrame` の常時ループを回さない）。
これにより「考える時間は無限」というターン制ローグライクの性質が自然に得られ、CPU も食わない。

```
[入力]  keydown / click / tap
   │
   ▼
input.ts  →  Intent { type: 'move', dir } | { type: 'useItem', id } | ...
   │
   ▼
turn.ts   resolvePlayerTurn(state, intent)
   ├─ 移動先が敵         → combat.playerAttack()
   ├─ 移動先が壁         → 何もしない（ターンを消費しない）
   ├─ 移動先が床/アイテム → move + loot.pickup()
   └─ 移動先が階段       → descend()
   │
   ▼
turn.ts   resolveEnemyTurns(state)
   └─ 各敵: speed 回だけ enemy.act()
        ├─ プレイヤーと隣接 → combat.enemyAttack()
        └─ それ以外         → AI に従って移動
   │
   ▼
[死亡判定]  HP <= 0 → phase = 'dead'
   │
   ▼
view.ts   render(state)   ← 状態から画面を再構築
```

### ターンを消費しない行動
壁への移動、無効な入力、UI 操作（パネル開閉・サウンド切替）はターンを進めない。
「壁にぶつかって敵に殴られた」という理不尽を避けるため。

## 2.5 状態管理

`GameState` は単一のプレーンオブジェクト。イミュータブルにはせず、その場で書き換える（ローグライクの規模ではコピーコストの方が無駄）。
代わりに **状態を書き換えてよいのは `game/` だけ** という規律で守る。

```ts
type Phase = 'title' | 'playing' | 'levelup' | 'event' | 'dead';
```

`phase` がモーダルの表示制御とゲーム入力の受付可否を兼ねる。
`levelup` / `event` 中は移動入力を無視し、選択が終わると `playing` に戻る。

## 2.6 描画方針

- ダンジョンは **1 枚の SVG** として描画する。タイル = `<g transform="translate(x,y)">`。
  DOM ノード数は 15×15 = 225 + アクター数程度で、全消し再構築でも十分速い。
- HUD / パネル / ログは通常の DOM。
- 差分更新は最初は行わない。計測して遅ければタイル単位のキャッシュを入れる（早すぎる最適化を避ける）。
- 演出は CSS アニメーション（`animation` / `transition`）で表現し、JS からはクラス付与だけを行う。

## 2.7 ビルド戦略

開発中は Vite の HMR で TypeScript モジュールのまま動かし、出荷時に 1 ファイルへ畳む。

```
npm run dev     → http://localhost:5173  （モジュール分割のまま、HMR あり）
npm run build   → tsc --noEmit  →  vite build  →  node build/inline.mjs
                   型検査        単一チャンク化      HTML へ JS/CSS を埋め込み
                                                  ↓
                                          dist/delve.html  （これ 1 枚が完成品）
```

`assetsInlineLimit` を極大にしてあるため、万一アセットを追加しても data URI として埋め込まれる。
`build/inline.mjs` は Node の標準モジュールのみで書かれており、追加の依存を持たない。

**ランタイム依存はゼロ**。`typescript` と `vite` はビルド時のみの devDependency で、
出荷される `dist/delve.html` には一切含まれない。

## 2.8 命名規約

| 対象 | 規約 | 例 |
|---|---|---|
| ファイル | kebab-case / 単数形 | `enemy.ts`, `dungeon.ts` |
| 型・インターフェース | PascalCase | `GameState`, `EnemyDef` |
| 関数・変数 | camelCase | `resolvePlayerTurn`, `maxHp` |
| 定数 | UPPER_SNAKE_CASE | `GRID_SIZE`, `BOSS_INTERVAL` |
| データテーブル | 複数形 | `ENEMIES`, `PERKS` |
| CSS クラス | kebab-case + BEM 風 | `.hud__stat`, `.tile--wall` |
