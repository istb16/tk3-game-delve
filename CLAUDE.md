# CLAUDE.md

DELVE — ターン制ローグライク・ダンジョン探索ゲーム。
*Go deeper. Survive longer.*

## このプロジェクトの絶対制約

出荷物は **`dist/delve.html` の 1 ファイルだけ**。ここが他のプロジェクトと最も違う点。

- ランタイムの外部ライブラリを追加しない（`dependencies` は空のまま）
- 外部画像ファイルを使わない。画像はすべて**インライン SVG**
- 外部音声ファイルを使わない。効果音は Web Audio API で**生成**する
- 外部フォントを読み込まない。システムフォントスタックのみ
- ネットワークアクセスなしで完全に動作する

依存を足したくなったら、まずそれが `devDependencies`（ビルド時のみ）で済むか考える。
済まないなら実装方針を変える。

## コマンド

```bash
npm install        # 初回のみ
npm run dev        # 開発サーバ (http://localhost:5173)
npm run typecheck  # 型検査のみ
npm run build      # tsc → vite build → 単一HTML化 → dist/delve.html
```

`npm run build` の後は `dist/delve.html` をブラウザで直接開いて（`file://` で）動作確認する。
単一ファイル化の破綻はここでしか見つからない。

## アーキテクチャ

詳細は [docs/02-architecture.md](docs/02-architecture.md)。要点だけ:

```
ui/ audio/     ← 描画・入力・音（DOM を触るのはここだけ）
   ↕
game/          ← ゲームルール（DOM を一切知らない）
   ↓
core/ data/ storage/
```

**依存の向きは常に上から下。** これを守る限りロジックだけを単独で検証できる。

### 破ってはいけない境界

1. **`src/game/` と `src/core/` に `document` / `window` を書かない。**
   DOM が必要になったのなら、それは `ui/` の仕事。
2. **`ui/` からゲーム状態を書き換えない。**
   UI は状態を読んで描くだけ。入力は Intent に変換して `game/` に渡す。
3. **`Math.random()` を直接呼ばない。** `src/core/rng.ts` の seeded RNG を通す。
   同じシードで同じダンジョンが再現できることがデバッグの生命線。
4. **バランス数値をロジックに直接書かない。** `src/data/` のテーブルに置く。
   敵・装備・アイテム・パークの追加が「テーブルに 1 行足すだけ」で済む形を維持する。

## ターンの進み方

入力駆動。プレイヤーが入力するまで状態は 1 ミリも進まない（常時ループを回さない）。

```
入力 → Intent → resolvePlayerTurn() → resolveEnemyTurns() → 死亡判定 → render()
```

**壁への移動・無効な入力・UI 操作はターンを消費しない。**
「壁にぶつかった隙に殴られた」という理不尽を作らないため。

## 実装の順序

[docs/07-roadmap.md](docs/07-roadmap.md) のフェーズに従う。原則:

- **基本ループ（移動 → 敵 → 戦闘 → 階段 → 次の階）を最優先で完成させる。**
- 各フェーズの終わりで必ず遊べる状態にしてコミットする。壊れたまま次へ進まない。
- **演出は最後。** ゲームプレイが面白くなる前に見た目を磨かない。

## コード規約

| 対象 | 規約 |
|---|---|
| ファイル名 | kebab-case・単数形 (`enemy.ts`) |
| 型 | PascalCase (`GameState`) |
| 関数・変数 | camelCase (`resolvePlayerTurn`) |
| 定数 | UPPER_SNAKE_CASE (`GRID_SIZE`) |
| データテーブル | 複数形 (`ENEMIES`, `PERKS`) |
| CSS クラス | kebab-case + BEM 風 (`.hud__stat`, `.tile--wall`) |

- TypeScript は `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`。
  配列アクセスは `undefined` を返す前提で書く。
- 型のインポートは `import type { ... }`（`verbatimModuleSyntax` のため必須）。
- コメントは「なぜそうしたか」を書く。「何をしているか」はコードで示す。

## ドキュメント

`docs/` が設計の正本。実装が設計とずれたら、**コードを直すか docs を直すか**を選ぶ。
放置してどちらが正しいか分からない状態にしない。

| ドキュメント | 内容 |
|---|---|
| [01-requirements.md](docs/01-requirements.md) | 要件・完成条件 |
| [02-architecture.md](docs/02-architecture.md) | レイヤ構成・ターンループ・ビルド |
| [03-game-design.md](docs/03-game-design.md) | 数値バランス・敵・装備・パーク |
| [04-data-model.md](docs/04-data-model.md) | 型定義・セーブデータ |
| [05-ui-design.md](docs/05-ui-design.md) | レイアウト・SVG・演出 |
| [06-dungeon-generation.md](docs/06-dungeon-generation.md) | 生成アルゴリズム |
| [07-roadmap.md](docs/07-roadmap.md) | フェーズと受け入れ基準 |

## 設計判断で迷ったときの基準

このゲームの面白さは以下の掛け合わせから来る。

```
ランダム生成 × キャラクター成長 × 装備 × ビルド × リスク判断
```

機能を足すか迷ったら「**プレイヤーに新しい判断を生むか**」で決める。
生まないなら、それはただの複雑さ。

ノーリスクの得を作らない。すべての報酬には対価か賭けを置く。

## コミット

日本語で書く。1 コミット = 1 つのまとまった変更。壊れた状態をコミットしない。
