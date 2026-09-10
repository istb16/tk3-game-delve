# 02. アーキテクチャ設計

## 2.1 設計原則

1. **ロジックは DOM を知らない** — `src/game/` と `src/core/` は `document` / `window` を参照しない。
   状態遷移が純粋関数に近い形で完結するため、ブラウザなしで検証できる（→ [08](08-verification.md)）。
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
│  core/         型・定数・RNG・ログ             │
│  storage/      localStorage 永続化            │
└─────────────────────────────────────────────┘
```

依存の向きは常に **上 → 下**。`core` は誰にも依存しない。`game` は `core` と `data` にのみ依存する。

## 2.3 ディレクトリ構成

`✅` = 実装済み / `🔜 Pn` = Phase n で作成予定。

```
tk3-game-delve/
├─ index.html            ✅ 開発用エントリ（ビルド時に単一ファイル化）
├─ vite.config.ts        ✅ 単一チャンク出力の設定
├─ build/inline.mjs      ✅ JS/CSS を HTML に埋め込む後処理
├─ tools/
│  └─ difficulty-model.mjs  ✅ 難易度カーブの検算（→ 07）
├─ docs/                 ✅ 設計書
└─ src/
   ├─ main.ts            ✅ 起動・入力配線
   ├─ vite-env.d.ts      ✅ CSS 副作用インポートの型宣言
   ├─ core/
   │  ├─ types.ts        ✅ 全レイヤ共有の型定義
   │  ├─ constants.ts    ✅ グリッドサイズ等の定数
   │  ├─ rng.ts          ✅ seeded 乱数（mulberry32）
   │  └─ log.ts          ✅ メッセージログ
   ├─ game/
   │  ├─ state.ts        ✅ GameState の生成・階層遷移
   │  ├─ dungeon.ts      ✅ ダンジョン生成・BFS・視界（→ 06）
   │  ├─ player.ts       ✅ プレイヤー生成・成長
   │  ├─ enemy.ts        ✅ 敵の生成と AI
   │  ├─ combat.ts       ✅ ダメージ計算・撃破処理
   │  ├─ turn.ts         ✅ ターン進行
   │  ├─ loot.ts         🔜 P2 ドロップ抽選・拾得
   │  └─ progression.ts  🔜 P2 パーク・装備によるステータス再計算
   ├─ data/
   │  ├─ enemies.ts      ✅ 敵テーブル
   │  ├─ equipment.ts    🔜 P2 装備テーブル
   │  ├─ items.ts        🔜 P2 アイテムテーブル
   │  ├─ perks.ts        🔜 P2 パークテーブル
   │  └─ achievements.ts 🔜 P4 実績テーブル
   ├─ ui/
   │  ├─ view.ts         ✅ ルート描画（ログ・モーダルを含む）
   │  ├─ hud.ts          ✅ ステータス表示
   │  ├─ board.ts        ✅ ダンジョン描画
   │  ├─ sprites.ts      ✅ ドット絵スプライト定義（→ 05）
   │  ├─ pixel.ts        ✅ スプライト定義 -> SVG symbol 変換
   │  ├─ favicon.ts      ✅ スプライトから favicon を生成（→ 05 §5.7）
   │  ├─ i18n.ts         ✅ EN / JA の表示文字列（→ 05 §5.14）
   │  ├─ input.ts        ✅ キーボード / マウス / タッチ
   │  └─ panels.ts       🔜 P2 装備 / パーク / アイテム
   ├─ audio/sfx.ts       🔜 P4 Web Audio 効果音
   ├─ storage/
   │  ├─ settings.ts     ✅ 言語 / 方向キー設定の永続化
   │  └─ save.ts         🔜 P2 ハイスコア・実績の永続化
   └─ styles/main.css    ✅ スタイル
```

ログ表示とモーダルは独立ファイルにせず `view.ts` に置いている。
どちらも `GameState` を読んで文字列を返すだけで、切り出すほどの分量も依存もないため。
分量が増えたら `logview.ts` / `modal.ts` に切り出す。

## 2.4 ターンループ

ゲームは **入力駆動**。プレイヤーの入力があるまで一切の状態は進まない
（`requestAnimationFrame` の常時ループを回さない）。
これにより「考える時間は無限」というターン制ローグライクの性質が自然に得られ、CPU も食わない。

```
[入力]  keydown / click / tap
   │
   ▼
input.ts  →  Intent { type: 'move', dir } | { type: 'wait' } | ...
   │
   ▼
turn.ts   resolvePlayerTurn(state, intent)
   ├─ 移動先が敵         → combat.playerAttack()
   ├─ 移動先が壁         → 何もしない（ターンを消費しない）
   ├─ 移動先が床/アイテム → move + steps++ + loot.pickup()
   └─ 移動先が階段       → descend()（このターンは敵を動かさない）
   │
   ▼
turn.ts   resolveEnemyTurns(state)
   └─ 各敵: speed 回だけ enemy.act()
        ├─ プレイヤーと隣接 → combat.enemyAttack()
        └─ それ以外         → AI に従って移動（成功したら steps++）
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

### 階段を降りた直後

新フロアの敵には、到着したそのターンの行動を与えない。
降りた瞬間に囲まれて殴られるのは、プレイヤーに選択の余地がない。

## 2.5 状態管理

`GameState` は単一のプレーンオブジェクト。イミュータブルにはせず、その場で書き換える
（ローグライクの規模ではコピーコストの方が無駄）。
代わりに **状態を書き換えてよいのは `game/` だけ** という規律で守る。

```ts
type Phase = 'playing' | 'choosing' | 'dead';
```

`phase` がモーダルの表示制御とゲーム入力の受付可否を兼ねる。
`choosing` 中は移動入力を無視し、選択が終わると `playing` に戻る。

`choosing` はレベルアップのパーク選択と装備の持ち替えの両方を受け持つ。
どちらも「選択肢を出して1つ選ばせる」という同じ形なので、
`pendingChoices` の列とモーダルを共通化している（イベントは Phase 3 でここに足す）。

## 2.6 描画方針

盤面はドット絵。詳細は [05](05-ui-design.md)。アーキテクチャ上の要点だけ:

- ダンジョンは **1 枚の SVG**。スプライトは `<defs>` の `<symbol>` に一度だけ定義し、
  各タイルは `<use>` で参照する。要素数は `<use>` 225 個 + 定義 20 個程度に収まる。
- 16×16 のドット絵定義 → `<symbol>` への変換は起動時に一度だけ行い、結果をキャッシュする。
- HUD / パネル / ログは通常の DOM。
- 差分更新は行わない。全消し再構築で足りる規模。計測して遅ければタイル単位のキャッシュを入れる。
- 演出は CSS アニメーションで表現し、JS からはクラス付与だけを行う。

### アニメーション状態を UI に持たせない

歩行フレームは `actor.steps % 2` から導出する。UI 側にアニメーション用の可変状態を置くと、
「UI はゲーム状態を書き換えない」という境界が形骸化するため。

### 演出はターン処理をブロックしない

ターン解決は同期・即時に完了する。演出中に次の入力が来た場合は演出を中断して次の状態を描く。
アニメーションキューは持たない（理由は [05 §5.10](05-ui-design.md)）。

## 2.7 ビルド戦略

開発中は Vite の HMR で TypeScript モジュールのまま動かし、出荷時に 1 ファイルへ畳む。

```
npm run dev     → http://localhost:5273  （モジュール分割のまま、HMR あり）
npm run build   → tsc --noEmit  →  vite build  →  node build/inline.mjs
                   型検査        単一チャンク化      HTML へ JS/CSS を埋め込み
                                                  ↓
                                          dist/delve.html  （これ 1 枚が完成品）
```

`assetsInlineLimit` を極大にしてあるため、万一アセットを追加しても data URI として埋め込まれる。
`build/inline.mjs` は Node の標準モジュールのみで書かれており、追加の依存を持たない。

**ランタイム依存はゼロ。** `typescript` / `vite` / `vitest` はビルド・テスト時のみの
devDependency で、出荷される `dist/delve.html` には一切含まれない。

ビルド後の検証手順は [08 §8.5](08-verification.md)。

## 2.8 命名規約

| 対象 | 規約 | 例 |
|---|---|---|
| ファイル | kebab-case / 単数形 | `enemy.ts`, `dungeon.ts` |
| 型・インターフェース | PascalCase | `GameState`, `EnemyDef` |
| 関数・変数 | camelCase | `resolvePlayerTurn`, `maxHp` |
| 定数 | UPPER_SNAKE_CASE | `GRID_SIZE`, `BOSS_INTERVAL` |
| データテーブル | 複数形 | `ENEMIES`, `PERKS` |
| CSS クラス | kebab-case + BEM 風 | `.hud__stat`, `.tile--wall` |
| SVG symbol の id | `sp-<名前>-<フレーム>` | `sp-player-0`, `sp-wall` |
