# 03. ゲームデザイン

数値は初期値であり、プレイテストで調整する前提。定義はすべて `src/data/` のテーブルに置き、
バランス変更でロジックを触らないようにする。

## 3.1 プレイヤー初期値と成長

| 項目 | 初期値 | レベルアップ時 |
|---|---|---|
| Max HP | 30 | +6 |
| Attack | 8 | +2 |
| Defense | 2 | +1 |
| Level | 1 | +1 |
| Gold | 0 | — |

### 必要経験値

```
nextExp(level) = 10 * level * (level + 1) / 2
```

| Lv | 累計必要 EXP |
|---|---|
| 1 → 2 | 10 |
| 2 → 3 | 30 |
| 3 → 4 | 60 |
| 4 → 5 | 100 |
| 5 → 6 | 150 |

序盤のレベルアップを速くして「強くなっている手応え」を早期に与え、
後半は装備とパークで伸ばす設計。

## 3.2 ダメージ計算

```
base       = attacker.attack - defender.defense
damage     = max(1, base)
critical   = rng() < attacker.critChance  →  damage = floor(damage * 1.8)
```

- 下限 1 を保証し、「まったく通らない」状況を作らない（詰みの回避）。
- クリティカル基礎値はプレイヤー 5%、敵 0%。装備とパークで上昇。

## 3.3 敵

`hp / atk / def / speed / exp / gold` と特殊能力を持つ。`speed` は 1 ターンあたりの行動回数。

| 敵 | HP | ATK | DEF | Speed | EXP | 出現階 | 特殊能力 |
|---|---|---|---|---|---|---|---|
| **Rat** | 8 | 4 | 0 | 2 | 3 | 1+ | 素早い。2 回行動するが弱い |
| **Goblin** | 14 | 7 | 1 | 1 | 6 | 1+ | 標準。HP 30% 以下で逃走する |
| **Skeleton** | 26 | 8 | 4 | 1 | 12 | 3+ | 高 HP・高防御。撃破時に 1 度だけ復活（HP 30%） |
| **Bat** | 10 | 6 | 0 | 2 | 8 | 2+ | 移動がランダム寄り（直進しない）。回避 20% |
| **Slime** | 18 | 6 | 2 | 1 | 10 | 4+ | 撃破時に HP 半分の小 Slime 2 体に分裂（1 回まで） |
| **Warden** | 45 | 14 | 6 | 1 | 30 | 7+ | 強敵。隣接時に確率で防御態勢（被ダメ半減） |
| **Boss** | 90 | 20 | 8 | 1 | 100 | 5 の倍数 | 階層ごとに固有能力。撃破で確定レア装備 |

### 階層スケーリング

```
scale(floor)  = 1 + (floor - 1) * 0.12
enemy.hp      = floor(base.hp  * scale)
enemy.attack  = floor(base.atk * scale)
enemy.defense = floor(base.def * scale)
enemy.exp     = floor(base.exp * scale)
```

出現数は `3 + floor(floor / 2)`、上限 10 体。

### 敵 AI

| AI | 挙動 |
|---|---|
| `chase` | プレイヤーへ最短方向に接近。隣接したら攻撃（Goblin / Skeleton / Warden / Boss） |
| `swift` | `chase` と同じだが 1 ターンに 2 回行動（Rat） |
| `erratic` | 60% で `chase`、40% でランダム方向（Bat） |
| `flee` | HP が閾値以下でプレイヤーから離れる（Goblin の低 HP 時） |

視界外（プレイヤーから 6 マス超）の敵は行動しない。処理負荷を抑えつつ「近づくと動き出す」緊張感を出す。

## 3.4 装備

スロットは Weapon / Armor / Ring の 3 つ。同スロットに装備すると入れ替え、外した方は自動でゴールドに換金する
（インベントリ管理の煩雑さを避け、判断を「装備するか否か」だけに絞るため）。

### Weapon

| 名前 | ATK | 効果 | 出現階 |
|---|---|---|---|
| Rusty Dagger | +2 | — | 1+ |
| Iron Sword | +5 | — | 1+ |
| Flame Blade | +8 | 10% で Burn（3 ターン継続ダメージ） | 4+ |
| Vampire Fang | +4 | 与ダメージの 5% を HP 回復 | 5+ |
| Assassin Kris | +6 | Critical +15% | 6+ |
| Warden's Maul | +12 | Critical −5%、命中時に敵を 1 ターン鈍足化 | 9+ |

### Armor

| 名前 | DEF | 効果 | 出現階 |
|---|---|---|---|
| Leather Vest | +2 | — | 1+ |
| Chain Mail | +4 | — | 3+ |
| Thorn Plate | +5 | 被弾時に攻撃者へ 3 反射ダメージ | 6+ |
| Shadow Cloak | +3 | 回避 +12% | 7+ |

### Ring

| 名前 | 効果 | 出現階 |
|---|---|---|
| Ring of Vigor | Max HP +15 | 2+ |
| Ring of Fury | Attack +10% | 4+ |
| Ring of Fortune | ゴールド獲得 +30% | 3+ |
| Ring of Insight | 獲得経験値 +20% | 5+ |

## 3.5 アイテム

所持上限 8 スロット。数字キー `1`–`8` で使用。

| アイテム | 効果 |
|---|---|
| **Potion** | HP を最大値の 40% 回復 |
| **Bomb** | 周囲 8 マスの敵に 20 ダメージ。壁を破壊する |
| **Scroll** | 使用時にランダム効果を抽選（下表） |
| **Key** | 施錠された宝箱を開ける |

### Scroll のランダム効果

| 効果 | 重み |
|---|---|
| 全画面の敵に 15 ダメージ | 3 |
| フロア全体のマップを露出 | 3 |
| 階段へテレポート | 2 |
| 3 ターンの間 Attack 2 倍 | 2 |
| 敵を 1 体ランダムに消滅 | 1 |
| 呪い: Max HP −5（ハズレ） | 1 |

ハズレを 1 枠だけ混ぜることで「読むかどうか」自体を判断にする。

## 3.6 パーク（レベルアップ時に 3 択から 1 つ）

| パーク | 効果 |
|---|---|
| Sharpened | Attack +10% |
| Vitality | Max HP +15（同時に全回復） |
| Deadly Aim | Critical +10% |
| Ironhide | Defense +2 |
| Lifesteal | 与ダメージの 8% を HP 回復 |
| Poison Attack | 攻撃時 20% で毒（3 ターン、5 ダメージ/ターン） |
| Fire Damage | 攻撃時 15% で Burn |
| Shield | 3 ターンに 1 回、被ダメージを完全無効化 |
| Treasure Sense | 宝箱・ゴールドの位置をマップに表示 |
| Swift Step | 25% の確率で移動がターンを消費しない |

同じパークは重複取得可（`Sharpened` を 3 回取れば +30%）。ビルドを尖らせる選択を許す。

## 3.7 階層とイベント

```
FLOOR 1 → 2 → 3 → 4 → [BOSS 5] → 6 → ... → [BOSS 10] → ...
```

深度に上限は設けない。5 の倍数階でボス。

### 深度による変化

| 深度 | 変化 |
|---|---|
| 敵の強さ | `scale(floor)` で線形上昇 |
| 敵の数 | `3 + floor/2`（上限 10） |
| ダンジョンの複雑さ | 部屋数が増え、通路が長くなる |
| レア装備出現率 | `min(0.05 + floor * 0.02, 0.45)` |
| イベント発生率 | `min(0.15 + floor * 0.01, 0.40)` |

### ランダムイベント

| イベント | 内容 |
|---|---|
| **Mysterious Shrine** | 「50 Gold を捧げるか？」YES → Attack +20% / Max HP −10 |
| **Merchant** | ゴールドで装備・ポーションを購入 |
| **Cursed Chest** | 開けると 70% でレア装備、30% で罠（最大 HP の 25% ダメージ） |
| **Healing Spring** | HP 全回復。ただしそのフロアの敵が 2 体増える |
| **Strange Altar** | 装備 1 つを生贄に捧げて別のランダム装備を得る |
| **Hidden Room** | 隠し部屋が出現。ゴールドとアイテムが集中している |
| **Treasury** | ゴールド大量。ただし Warden が 1 体守っている |

すべて「対価のあるリターン」で構成し、ノーリスクの得を作らない。

## 3.8 スコア

```
score = reachedFloor * 1000
      + kills        * 50
      + gold
      + level        * 200
```

深く潜ることを最大の評価軸に置き、「稼ぎのために浅い階に留まる」戦略が最適解にならないようにする。

## 3.9 実績

| 実績 | 解除条件 |
|---|---|
| First Blood | 初めて敵を倒す |
| Deep Diver | Floor 5 に到達 |
| Treasure Hunter | 1 回の Run で宝箱を 10 個開ける |
| Slayer | 1 回の Run で敵を 30 体倒す |
| Boss Killer | ボスを初めて倒す |
| Centurion | 累計 100 体撃破 |
| Floor 10 | Floor 10 に到達 |
| Floor 25 | Floor 25 に到達 |
| Floor 50 | Floor 50 に到達 |
