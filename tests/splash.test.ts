import { describe, expect, it } from 'vitest';

import pkg from '../package.json';
import { FADE_MS, SPLASH_MS } from '../src/ui/splash';

/**
 * スプラッシュは DOM を触るので本体は node 環境のテストで動かせない。
 * 代わりに「壊れても気づきにくい」2点だけを見る。
 */
describe('タイトルスプラッシュ', () => {
  it('表示するバージョンは package.json と一致する', () => {
    // vite.config.ts の define が落ちると、ここで `__APP_VERSION__` が
    // 未定義になるか古い値のまま残る。表示だけでは気づけない。
    expect(__APP_VERSION__).toBe(pkg.version);
  });

  it('出しっぱなしにする時間は3秒前後に収まっている', () => {
    expect(SPLASH_MS).toBeGreaterThanOrEqual(2000);
    expect(SPLASH_MS).toBeLessThanOrEqual(4000);
  });

  it('フェードは表示時間より十分に短い', () => {
    expect(FADE_MS).toBeLessThan(SPLASH_MS / 2);
  });
});
