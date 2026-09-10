import { describe, expect, it } from 'vitest';
import type { SpriteDef } from '../src/ui/pixel';
import { SPRITE_SIZE, validateSprite } from '../src/ui/pixel';
import { allSprites } from '../src/ui/sprites';
import { ELIXIR_HEAL, POTION_HEAL } from '../src/core/constants';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  area: number;
}

/** 全フレームをまとめた外接矩形。 */
function boundingBox(def: SpriteDef): Box {
  let left = SPRITE_SIZE;
  let right = -1;
  let top = SPRITE_SIZE;
  let bottom = -1;

  for (const frame of def.frames) {
    frame.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    });
  }
  const width = right - left + 1;
  const height = bottom - top + 1;
  return { left, right, top, bottom, width, height, area: width * height };
}

function find(id: string): SpriteDef {
  const found = allSprites().find((s) => s.id === id);
  if (!found) throw new Error(`スプライトが無い: ${id}`);
  return found.def;
}

describe('ドット絵の形式', () => {
  it('すべてのスプライトが 16x16 で、未定義のパレット番号を含まない', () => {
    for (const { id, def } of allSprites()) {
      expect(() => validateSprite(id, def)).not.toThrow();
    }
  });

  it('歩行アニメーションは 2 フレーム', () => {
    for (const kind of ['player', 'rat', 'goblin', 'bat', 'skeleton', 'slime', 'warden', 'boss']) {
      const def = find(`sp-${kind}-0`);
      expect(def.frames.length, `${kind} のフレーム数`).toBe(2);
    }
  });

  it('歩行フレーム間で絵が横にずれない（足元だけが変わる）', () => {
    for (const kind of ['player', 'goblin', 'skeleton', 'warden', 'boss']) {
      const def = find(`sp-${kind}-0`);
      const [a, b] = def.frames;
      if (!a || !b) continue;

      // 上半分は完全に一致していること。ここが変わると歩行ではなく痙攣に見える。
      for (let y = 0; y < SPRITE_SIZE / 2; y++) {
        expect(a[y], `${kind} の上半分 y=${y}`).toBe(b[y]);
      }
    }
  });
});

describe('見た目の識別性', () => {
  it('回復量が違うアイテムは瓶の大きさも違う', () => {
    const potion = boundingBox(find('sp-potion-0'));
    const elixir = boundingBox(find('sp-elixir-0'));

    // 回復量は Elixir の方が大きい
    expect(ELIXIR_HEAL).toBeGreaterThan(POTION_HEAL);

    // 色だけを変えると暗い盤面では見分けが付かないので、
    // 大きさそのもので差を付ける（→ docs/05）。
    expect(elixir.height, 'Elixir の方が背が高いこと').toBeGreaterThan(potion.height);
    expect(elixir.area / potion.area, 'Elixir の面積が十分に大きいこと').toBeGreaterThan(1.5);
  });

  it('盤面に立つものは水平方向に中央へ寄っている', () => {
    // 左右の余白が偏ると、並べたときに絵が傾いて見える。
    const centered = ['player', 'goblin', 'bat', 'skeleton', 'slime', 'warden', 'boss'];
    for (const kind of centered) {
      const box = boundingBox(find(`sp-${kind}-0`));
      const center = (box.left + box.right) / 2;
      expect(Math.abs(center - (SPRITE_SIZE - 1) / 2), `${kind} の中心のずれ`).toBeLessThanOrEqual(1);
    }
  });

  it('敵は互いに異なるシルエットを持つ', () => {
    const kinds = ['rat', 'goblin', 'bat', 'skeleton', 'slime', 'warden', 'boss'];
    const shapes = kinds.map((kind) => {
      const frame = find(`sp-${kind}-0`).frames[0] ?? [];
      // 透明かどうかだけを見た形（色を無視した輪郭）
      return frame.map((row) => [...row].map((c) => (c === '.' ? '.' : '#')).join('')).join('|');
    });
    expect(new Set(shapes).size, '同じ輪郭の敵がいる').toBe(kinds.length);
  });
});
