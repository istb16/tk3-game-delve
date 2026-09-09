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
| リスタート（死亡時） | `Enter` |

画面上部で **表示言語（EN / JA）** と **方向キーの表示（AUTO / ON / OFF）** を切り替えられます。
どちらも localStorage に保存され、次回訪問時に復元されます。
`AUTO` はタッチ端末か画面幅 900px 未満で方向キーを表示します（iPhone は該当）。

## 開発

```bash
npm run dev        # 開発サーバ (http://localhost:5273)
npm run typecheck  # 型検査
npm run build      # 単一HTML化 → dist/delve.html

node tools/difficulty-model.mjs   # 難易度カーブの検算
```

## 実装状況

詳細は [docs/09-roadmap.md](docs/09-roadmap.md)。

- [x] Phase 1a — ランダムダンジョン / 移動 / 敵AI / 戦闘 / 階層 / 死亡 / リスタート
- [x] Phase 1b — ドット絵スプライトと歩行アニメーション / favicon / EN・JA 切替 / 方向キー設定
- [ ] Phase 2 — パーク選択 / 装備 / アイテム / localStorage / テスト導入
- [ ] Phase 3 — 敵7種と特殊能力 / ボス / ランダムイベント / ステータス効果
- [ ] Phase 4 — 実績 / 演出 / サウンド / モバイル最適化

## ドキュメント

設計書は [docs/](docs/README.md)、開発方針は [CLAUDE.md](CLAUDE.md) にあります。
