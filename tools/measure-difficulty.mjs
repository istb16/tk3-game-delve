/**
 * 難易度カーブの実測。vitest 経由でボットを走らせて到達階層の分布を出す。
 *
 *   npm run measure
 *
 * 検算モデル（difficulty-model.mjs）が「1回の交戦の余裕」を見るのに対し、
 * こちらは Run 全体を実際に回して結果を見る。両方を見ないと片方が破綻する
 * （経緯は docs/07 §7.8）。
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { summarize } = await server.ssrLoadModule('/tests/helpers/bot.ts');
const { hpScale, atkScale, defScale } = await server.ssrLoadModule('/src/core/constants.ts');

const count = Number(process.argv[2] ?? 40);

console.log('階層スケーリング');
for (const f of [1, 3, 5, 10, 15, 20, 30]) {
  console.log(
    `  F${String(f).padStart(2)}  hp x${hpScale(f).toFixed(2)}  atk x${atkScale(f).toFixed(2)}  def x${defScale(f).toFixed(2)}`,
  );
}

const result = summarize(count);
console.log(`\n到達階層の分布（${count} run）`);
console.log(`  中央値 ${result.median} / 平均 ${result.mean} / 最小 ${result.min} / 最大 ${result.max}`);
console.log(`  ${Object.entries(result.bands).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`  平均Lv ${result.meanLevel} / 平均ターン ${result.meanTurns} / 打ち切り ${result.timedOut}`);

await server.close();
