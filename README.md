# DELVE

> Go deeper. Survive longer.

ターン制ローグライク・ダンジョン探索ゲーム。
**ビルド成果物は外部依存ゼロの HTML 1ファイル** — ブラウザで開くだけで動きます。

```
探索する → 敵を見つける → 戦う → アイテムを得る → 強くなる → より深く潜る → 死ぬ → もう一度挑戦する
```

## 遊ぶ

```bash
npm install && npm run build
```

生成された `dist/delve.html` をブラウザで開くだけ。サーバー不要。

| 操作 | キー |
|---|---|
| 移動 | `W` `A` `S` `D` / `↑` `↓` `←` `→` |
| 待機 | `.` / `Space` |
| アイテム使用 | `1` – `8`（クリック / タップでも可） |
| アイテムを捨てる | `Shift` + `1` – `8`（スロットの `×` でも可） |
| パーク選択（レベルアップ時） | `1` – `3` |
| リスタート（死亡時） | `Enter` |

効果音は既定で OFF です。HUD の「効果音」から切り替えられます。

画面上部で **表示言語（EN / JA）** と **方向キーの表示（AUTO / ON / OFF）** を切り替えられます。
どちらも localStorage に保存され、次回訪問時に復元されます。
`AUTO` はタッチ端末か画面幅 900px 未満で方向キーを表示します（iPhone は該当）。

## 開発

```bash
npm run dev        # 開発サーバ (http://localhost:5273)
npm run typecheck  # 型検査
npm test           # 不変条件テスト（vitest）
npm run build      # 単一HTML化 → dist/delve.html

node tools/difficulty-model.mjs   # 難易度カーブの検算
npm run measure 60                # 到達階層の実測
```

## 実装状況

詳細は [docs/09-roadmap.md](docs/09-roadmap.md)。

- [x] Phase 1a — ランダムダンジョン / 移動 / 敵AI / 戦闘 / 階層 / 死亡 / リスタート
- [x] Phase 1b — ドット絵スプライトと歩行アニメーション / favicon / EN・JA 切替 / 方向キー設定
- [x] Phase 2 — パーク選択 / 装備 / 宝箱 / スコアと記録 / vitest 導入
- [x] Phase 3 — 敵の特殊能力 / ボス / ランダムイベント / ステータス効果 / 巻物と鍵
- [x] Phase 4 — 実績 / 演出 / サウンド / モバイル最適化

## ドキュメント

設計書は [docs/](docs/README.md)、開発方針は [CLAUDE.md](CLAUDE.md) にあります。
