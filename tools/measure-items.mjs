/** 回復アイテムの供給と消費の収支を測る。 */
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { runBot } = await server.ssrLoadModule('/tests/helpers/bot.ts');
const { MAX_STACK } = await server.ssrLoadModule('/src/core/constants.ts');

const runs = [];
for (let seed = 1; seed <= 60; seed++) {
  const r = runBot(seed * 7919);
  const inv = r.state.player.inventory;
  const held = (id) => inv.reduce((n, s) => n + (s && s.itemId === id ? s.count : 0), 0);
  const slots = inv.filter(Boolean).length;
  const picked = r.state.log.filter((e) => e.key === 'log.pickup').length;
  const drank = r.state.log.filter((e) => e.key === 'log.usePotion' || e.key === 'log.useElixir').length;
  const full = r.state.log.filter((e) => e.key === 'log.inventoryFull').length;
  runs.push({ floor: r.floor, potion: held('potion'), elixir: held('elixir'),
              bomb: held('bomb'), scroll: held('scroll'), key: held('key'),
              slots, picked, drank, full });
}
const avg = (f) => +(runs.reduce((s, r) => s + f(r), 0) / runs.length).toFixed(1);
console.log(`到達階層の平均 ${avg((r) => r.floor)}`);
console.log('死亡時に持っていた数（平均）');
for (const id of ['potion', 'elixir', 'bomb', 'scroll', 'key']) {
  console.log(`  ${id.padEnd(7)} ${avg((r) => r[id])}`);
}
console.log(`使用スロット数 ${avg((r) => r.slots)} / 8   (1スロット上限 ${MAX_STACK})`);
console.log(`拾った回数 ${avg((r) => r.picked)} / 飲んだ回数 ${avg((r) => r.drank)}`);
console.log(`満杯で拾えなかった ${avg((r) => r.full)} 回`);
const surplus = runs.filter((r) => r.potion + r.elixir >= 4).length;
console.log(`死亡時に回復を4個以上抱えていた run: ${surplus}/${runs.length}`);
await server.close();
