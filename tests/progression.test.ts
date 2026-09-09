import { describe, expect, it } from 'vitest';
import { BASE_CRIT, LEVEL_UP_GAIN, PLAYER_BASE } from '../src/core/constants';
import { createGame } from '../src/game/state';
import { equip, recalcStats, rollPerkOptions, takePerk } from '../src/game/progression';
import { gainExp } from '../src/game/player';
import { EQUIPMENT, toEquipment } from '../src/data/equipment';
import { PERKS } from '../src/data/perks';

function equipmentById(id: string) {
  const def = EQUIPMENT.find((e) => e.id === id);
  if (!def) throw new Error(`装備が見つからない: ${id}`);
  return toEquipment(def);
}

describe('派生値の再計算', () => {
  it('装備を着けて外すと元の値に戻る（引き忘れがない）', () => {
    const state = createGame(1);
    const before = {
      attack: state.player.attack,
      defense: state.player.defense,
      maxHp: state.player.maxHp,
      crit: state.player.critChance,
      evasion: state.player.evasion,
      lifesteal: state.player.lifesteal,
      thorns: state.player.thorns,
      goldPct: state.player.goldPct,
      expPct: state.player.expPct,
    };

    // 全スロットに補正の強い装備を着ける
    equip(state.player, equipmentById('assassinKris'));
    equip(state.player, equipmentById('thornPlate'));
    equip(state.player, equipmentById('ringOfFury'));
    expect(state.player.attack).toBeGreaterThan(before.attack);

    state.player.equipment = { weapon: null, armor: null, ring: null };
    recalcStats(state.player);

    expect({
      attack: state.player.attack,
      defense: state.player.defense,
      maxHp: state.player.maxHp,
      crit: state.player.critChance,
      evasion: state.player.evasion,
      lifesteal: state.player.lifesteal,
      thorns: state.player.thorns,
      goldPct: state.player.goldPct,
      expPct: state.player.expPct,
    }).toEqual(before);
  });

  it('レベル1の初期値が定数どおり', () => {
    const state = createGame(2);
    expect(state.player.maxHp).toBe(PLAYER_BASE.maxHp);
    expect(state.player.attack).toBe(PLAYER_BASE.attack);
    expect(state.player.defense).toBe(PLAYER_BASE.defense);
    expect(state.player.critChance).toBeCloseTo(BASE_CRIT);
  });

  it('乗算補正は加算をすべて足した後に掛かる', () => {
    const state = createGame(3);
    const base = state.player.attack;
    equip(state.player, equipmentById('ironSword')); // +5
    const withSword = state.player.attack;
    expect(withSword).toBe(base + 5);

    equip(state.player, equipmentById('ringOfFury')); // +10%
    expect(state.player.attack).toBe(Math.floor((base + 5) * 1.1));
  });

  it('最大HPが下がっても現在HPが超過しない', () => {
    const state = createGame(4);
    equip(state.player, equipmentById('ringOfVigor')); // Max HP +15
    state.player.hp = state.player.maxHp;
    const boosted = state.player.maxHp;

    state.player.equipment.ring = null;
    recalcStats(state.player);

    expect(state.player.maxHp).toBeLessThan(boosted);
    expect(state.player.hp).toBe(state.player.maxHp);
  });

  it('レベルアップの伸びが定数どおり（装備と二重に足されない）', () => {
    const state = createGame(5);
    equip(state.player, equipmentById('ironSword'));
    const attackAtLv1 = state.player.attack;

    gainExp(state, state.player.nextExp);
    expect(state.player.level).toBe(2);
    expect(state.player.attack).toBe(attackAtLv1 + LEVEL_UP_GAIN.attack);
  });
});

describe('パーク', () => {
  it('選択肢は重複せず、指定数だけ出る', () => {
    const state = createGame(6);
    for (let i = 0; i < 50; i++) {
      const options = rollPerkOptions(state.rng, state.player);
      expect(options.length).toBe(3);
      expect(new Set(options).size).toBe(options.length);
    }
  });

  it('挙動系のパークは重複して提示されない', () => {
    const state = createGame(7);
    takePerk(state, 'swiftStep');
    takePerk(state, 'treasureSense');

    for (let i = 0; i < 100; i++) {
      const options = rollPerkOptions(state.rng, state.player);
      expect(options).not.toContain('swiftStep');
      expect(options).not.toContain('treasureSense');
    }
  });

  it('数値系のパークは重ねて取れて効果が積み上がる', () => {
    const state = createGame(8);
    const base = state.player.attack;
    takePerk(state, 'sharpened');
    const once = state.player.attack;
    takePerk(state, 'sharpened');
    const twice = state.player.attack;

    expect(once).toBeGreaterThan(base);
    expect(twice).toBeGreaterThan(once);
    expect(state.player.perks.filter((p) => p === 'sharpened').length).toBe(2);
  });

  it('Vitality は取得時に全回復する', () => {
    const state = createGame(9);
    state.player.hp = 1;
    takePerk(state, 'vitality');
    expect(state.player.hp).toBe(state.player.maxHp);
  });

  it('すべてのパークに i18n で参照される定義がある', () => {
    // PerkId とテーブルの entries が一致していないと、選択肢に出た瞬間に落ちる
    const ids = PERKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const perk of PERKS) expect(perk.name.length).toBeGreaterThan(0);
  });
});
