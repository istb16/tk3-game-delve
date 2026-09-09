import type { GameState } from '../core/types';

/** 上部ステータス。数値を必ず併記し、色とバーだけに情報を載せない。 */
export function renderHud(state: GameState): string {
  const p = state.player;
  const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
  const expRatio = p.nextExp > 0 ? p.exp / p.nextExp : 0;

  return `
    <header class="hud">
      <div class="hud__brand">
        <span class="hud__title">DELVE</span>
        <span class="hud__tagline">Go deeper. Survive longer.</span>
      </div>
      <div class="hud__stats">
        ${stat('FLOOR', String(state.floor))}
        ${stat('LV', String(p.level))}
        ${bar('HP', `${p.hp}/${p.maxHp}`, hpRatio, 'hp')}
        ${bar('EXP', `${p.exp}/${p.nextExp}`, expRatio, 'exp')}
        ${stat('GOLD', String(p.gold))}
      </div>
    </header>
  `;
}

function stat(label: string, value: string): string {
  return `
    <div class="hud__stat">
      <span class="hud__label">${label}</span>
      <span class="hud__value">${value}</span>
    </div>`;
}

function bar(label: string, value: string, ratio: number, variant: string): string {
  const pct = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1);
  return `
    <div class="hud__stat hud__stat--bar">
      <span class="hud__label">${label}</span>
      <span class="hud__meter hud__meter--${variant}">
        <span class="hud__meter-fill" style="width:${pct}%"></span>
      </span>
      <span class="hud__value">${value}</span>
    </div>`;
}
