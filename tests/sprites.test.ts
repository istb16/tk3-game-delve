import { describe, expect, it } from 'vitest';
import type { SpriteDef } from '../src/ui/pixel';
import { SPRITE_SIZE, validateSprite } from '../src/ui/pixel';
import { allSprites, enemySpriteId, entitySpriteId, itemSpriteId } from '../src/ui/sprites';
import { ITEMS } from '../src/data/items';
import { ENEMIES } from '../src/data/enemies';
import { EQUIPMENT, toEquipment } from '../src/data/equipment';
import type { EntityPayload } from '../src/core/types';
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

describe('アイテムの説明', () => {
  it('回復量の説明が定数から組み立てられている', async () => {
    const { t } = await import('../src/ui/i18n');
    for (const lang of ['en', 'ja'] as const) {
      const potion = t(lang, 'itemDesc.heal', { percent: Math.round(POTION_HEAL * 100) });
      const elixir = t(lang, 'itemDesc.heal', { percent: Math.round(ELIXIR_HEAL * 100) });

      // 文言に数値を直接書くと、バランス調整のたびに説明と実効果がずれる
      expect(potion).toContain(String(Math.round(POTION_HEAL * 100)));
      expect(elixir).toContain(String(Math.round(ELIXIR_HEAL * 100)));
      expect(potion).not.toContain('{');
      expect(elixir).not.toContain('{');
      expect(potion).not.toBe(elixir);
    }
  });

  it('すべてのアイテムに説明がある', async () => {
    const { t } = await import('../src/ui/i18n');
    const keys = ['itemDesc.heal', 'itemDesc.bomb', 'itemDesc.scroll', 'itemDesc.key'] as const;
    for (const lang of ['en', 'ja'] as const) {
      for (const key of keys) {
        const text = t(lang, key, { percent: 40, damage: 20 });
        expect(text.length, `${lang}/${key}`).toBeGreaterThan(0);
        expect(text, `${lang}/${key} にプレースホルダが残っている`).not.toContain('{');
      }
    }
  });
});

/*
 * スプライト名の網羅。
 *
 * SPRITES のキーは アイテム・敵・タイル・装備が混在するので `Record<string, _>`
 * にしてある。つまり**追加漏れを型で防げない**。実際に「敵が全部ゴブリンで
 * 描かれる」状態を一度作っている。テーブルを足したら描けることをここで担保する。
 */
describe('スプライト名の網羅', () => {
  const ids = new Set(allSprites().map((s) => s.id));

  it('すべてのアイテムに絵がある', () => {
    for (const item of ITEMS) {
      expect(ids.has(itemSpriteId(item.id)), `${item.id} の絵が無い`).toBe(true);
    }
  });

  it('すべての敵に絵があり、別々の絵を使っている', () => {
    const used = new Set<string>();
    for (const def of ENEMIES) {
      const id = enemySpriteId(def.kind, 0);
      expect(ids.has(id), `${def.kind} の絵が無い`).toBe(true);
      // 借り物の絵を残したまま出荷しないための番人
      expect(used.has(id), `${def.kind} が他の敵と同じ絵を使っている`).toBe(false);
      used.add(id);
    }
  });

  it('床に落ちているものすべてに絵がある', () => {
    const anyEquipment = EQUIPMENT[0];
    if (!anyEquipment) throw new Error('装備テーブルが空');

    const payloads: EntityPayload[] = [
      { type: 'item', itemId: 'potion', count: 1 },
      { type: 'gold', amount: 1 },
      { type: 'chest', locked: false },
      { type: 'event', eventId: 'shrine' },
      { type: 'equipment', equipment: toEquipment(anyEquipment), declinedAgainst: null },
    ];
    for (const payload of payloads) {
      const id = entitySpriteId({ id: 'e', kind: payload.type, pos: { x: 0, y: 0 }, payload });
      expect(ids.has(id), `${payload.type} の絵が無い`).toBe(true);
    }
  });

  it('装備スロットすべてに絵がある', () => {
    for (const slot of ['weapon', 'armor', 'ring'] as const) {
      expect(ids.has(`sp-${slot}-0`), `${slot} の絵が無い`).toBe(true);
    }
  });
});
