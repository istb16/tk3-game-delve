/**
 * 難易度カーブの検算。設計書に載せる数値表をここで作る。
 *
 * 指標: Margin = TTD / TTK を「同時に相手取る敵の数 k」で補正したもの。
 *   TTK = 敵1体を倒すのに要するターン数
 *   TTD = 敵の攻撃で死ぬまでのターン数
 *   k体を同時に相手取ると TTK は k倍、被ダメージも k倍なので Margin は 1/k^2 になる。
 *
 * 設計目標（Margin_group）:
 *   F1-3   4.0  導入。ほぼ死なない
 *   F4-9   2.2  本番。囲まれると危ない
 *   F10-15 1.3  壁。標準的な死亡帯（上手くないプレイヤーはここで終わる）
 *   F16-25 1.0  ビルドが噛み合った時だけ抜けられる
 *   F26+   0.8  事故が必ず起きる
 */

const TARGET = (f) => (f <= 3 ? 4.0 : f <= 9 ? 2.4 : f <= 15 ? 1.0 : f <= 25 ? 0.55 : 0.3);

// --- プレイヤー -------------------------------------------------------------
const P_BASE = { hp: 30, atk: 8, def: 2 };
const P_GAIN = { hp: 6, atk: 2, def: 0.5 }; // def は +1/Lv から半減（後述）
const LEVELUP_HEAL = 0.4; // 全回復から変更
const expToNext = (L) => (10 * L * (L + 1)) / 2;

// --- 敵テーブル -------------------------------------------------------------
// maxFloor による引退ではなく、出現重みを深度のガウス分布で連続的にずらす。
// 引退方式は「その階を境に敵構成が一変する」段差を生むため。
const ENEMIES = [
  { name: 'Rat',      hp: 8,  atk: 4,  def: 0, spd: 2, exp: 3,  w: 5, peak: 2,  spread: 6 },
  { name: 'Goblin',   hp: 14, atk: 7,  def: 1, spd: 1, exp: 6,  w: 5, peak: 5,  spread: 8 },
  { name: 'Bat',      hp: 10, atk: 6,  def: 0, spd: 2, exp: 8,  w: 4, peak: 8,  spread: 8 },
  { name: 'Skeleton', hp: 26, atk: 8,  def: 4, spd: 1, exp: 12, w: 3, peak: 13, spread: 10 },
  { name: 'Slime',    hp: 18, atk: 6,  def: 2, spd: 1, exp: 10, w: 3, peak: 16, spread: 10 },
  { name: 'Warden',   hp: 45, atk: 14, def: 6, spd: 1, exp: 30, w: 2, peak: 26, spread: 14 },
];

// --- スケーリング（提案値） -------------------------------------------------
const hpScale = (f) => 1 + (f - 1) * 0.16;
const atkScale = (f) => 1 + (f - 1) * 0.14;
const defScale = (f) => 1 + (f - 1) * 0.06;
const enemyCount = (f) => Math.min(3 + Math.floor(f / 2), f >= 20 ? 12 : 10);

/** 同時に相手取る敵の数。フロアの敵密度から決まる。 */
const groupFactor = (f) => Math.min(2.4, 1 + (enemyCount(f) - 3) * 0.18);

function weightAt(e, f) {
  return e.w * Math.exp(-(((f - e.peak) / e.spread) ** 2));
}

/** その階層の「平均的な敵」を深度重み付きで作る */
function avgEnemy(f) {
  const total = ENEMIES.reduce((s, e) => s + weightAt(e, f), 0);
  const wavg = (key) => ENEMIES.reduce((s, e) => s + e[key] * weightAt(e, f), 0) / total;
  const share = ENEMIES.map((e) => ({ n: e.name.slice(0, 2), p: Math.round((weightAt(e, f) / total) * 100) }))
    .filter((x) => x.p >= 5)
    .map((x) => `${x.n}${x.p}`)
    .join(' ');
  return {
    hp: wavg('hp') * hpScale(f),
    atk: wavg('atk') * atkScale(f),
    def: wavg('def') * defScale(f),
    spd: wavg('spd'),
    exp: wavg('exp') * hpScale(f),
    share,
  };
}

// --- ビルド補正 -------------------------------------------------------------
function buildBonus(kind, f, L) {
  if (kind === 'naked') return { atkAdd: 0, atkMul: 1, defAdd: 0, hpAdd: 0 };
  return {
    atkAdd: 2 + Math.floor(f / 3) * 1.5,          // 階層相応の武器
    atkMul: 1 + 0.05 * Math.max(0, L - 1) * 0.5,  // 攻撃系パークを半分だけ取る前提
    defAdd: 1 + Math.floor(f / 6),                // 防具（floor/4 から緩和）
    hpAdd: 4 * Math.max(0, L - 1),
  };
}

// --- シミュレーション -------------------------------------------------------
function run(kind, killRate) {
  const rows = [];
  let level = 1;
  let exp = 0;
  let hpRatio = 1.0;

  for (let f = 1; f <= 40; f++) {
    const e = avgEnemy(f);
    const b = buildBonus(kind, f, level);
    const k = groupFactor(f);

    const maxHp = P_BASE.hp + P_GAIN.hp * (level - 1) + b.hpAdd;
    const pHp = maxHp * hpRatio;
    const pAtk = (P_BASE.atk + P_GAIN.atk * (level - 1) + b.atkAdd) * b.atkMul;
    const pDef = P_BASE.def + P_GAIN.def * (level - 1) + b.defAdd;

    const ttk = e.hp / Math.max(1, pAtk - e.def);
    const ttd = pHp / (Math.max(1, e.atk - pDef) * e.spd);
    const margin = ttd / ttk / k ** 2;

    rows.push({
      f, level, k: +k.toFixed(2),
      pHp: Math.round(pHp), pAtk: Math.round(pAtk), pDef: Math.round(pDef),
      eHp: Math.round(e.hp), eAtk: Math.round(e.atk), eDef: Math.round(e.def),
      count: enemyCount(f),
      ttk: +ttk.toFixed(1), ttd: +ttd.toFixed(1),
      margin: +margin.toFixed(2), target: TARGET(f),
      ratio: +(margin / TARGET(f)).toFixed(2),
      share: e.share,
    });

    exp += enemyCount(f) * e.exp * killRate;
    while (exp >= expToNext(level)) {
      exp -= expToNext(level);
      level++;
      hpRatio = Math.min(1, hpRatio + LEVELUP_HEAL);
    }
    hpRatio = Math.max(0.6, hpRatio - 0.02); // 深いほど満タンで次階に入れなくなる
  }
  return rows;
}

function table(title, rows) {
  console.log(`\n=== ${title} ===`);
  console.log(' F  Lv  pHP pATK pDEF | eHP eATK eDEF  x    k | TTK  TTD | Margin 目標  比 | 敵構成(%)');
  for (const r of rows) {
    if (r.f > 30) break;
    const flag = r.ratio < 0.7 ? ' 難' : r.ratio > 1.5 ? ' 易' : '';
    console.log(
      `${String(r.f).padStart(2)} ${String(r.level).padStart(3)} ${String(r.pHp).padStart(4)} ${String(r.pAtk).padStart(4)} ${String(r.pDef).padStart(4)} |` +
        ` ${String(r.eHp).padStart(3)} ${String(r.eAtk).padStart(4)} ${String(r.eDef).padStart(4)} ${String(r.count).padStart(2)} ${String(r.k).padStart(4)} |` +
        ` ${String(r.ttk).padStart(4)} ${String(r.ttd).padStart(4)} |` +
        ` ${String(r.margin).padStart(6)} ${String(r.target).padStart(4)} ${String(r.ratio).padStart(4)}${flag} | ${r.share}`,
    );
  }
}

table('標準ビルド（装備＋パークあり、撃破率0.8）', run('standard', 0.8));
table('裸ビルド（レベルのみ、撃破率0.8）', run('naked', 0.8));
