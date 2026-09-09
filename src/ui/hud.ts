import type { GameState } from '../core/types';
import type { DpadMode, Lang, Settings } from '../storage/settings';
import { t } from './i18n';

/**
 * 上部ステータスと設定。
 *
 * 数値の見出し（HP / EXP / FLOOR / LV / GOLD）は両言語とも英語のまま。
 * 短く自明で、日本語にすると却って読み取りが遅くなるため（→ i18n.ts の方針）。
 * 色とバーだけに情報を載せず、数値を必ず併記する。
 */
export function renderHud(state: GameState, settings: Settings): string {
  const p = state.player;
  const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
  const expRatio = p.nextExp > 0 ? p.exp / p.nextExp : 0;

  return `
    <header class="hud">
      <div class="hud__brand">
        <span class="hud__title">DELVE</span>
        <span class="hud__tagline">${t(settings.lang, 'ui.tagline')}</span>
      </div>
      <div class="hud__stats">
        ${stat('FLOOR', String(state.floor))}
        ${stat('LV', String(p.level))}
        ${bar('HP', `${p.hp}/${p.maxHp}`, hpRatio, 'hp')}
        ${bar('EXP', `${p.exp}/${p.nextExp}`, expRatio, 'exp')}
        ${stat('GOLD', String(p.gold))}
      </div>
      ${renderSettings(settings)}
    </header>
  `;
}

function renderSettings(settings: Settings): string {
  const lang = settings.lang;
  return `
    <div class="settings" role="group" aria-label="${t(lang, 'ui.settings')}">
      <div class="settings__group">
        <span class="settings__label">${t(lang, 'ui.language')}</span>
        ${langButton('en', 'EN', settings.lang)}
        ${langButton('ja', 'JA', settings.lang)}
      </div>
      <div class="settings__group">
        <span class="settings__label">${t(lang, 'ui.dpad')}</span>
        ${dpadButton('auto', t(lang, 'ui.auto'), settings.dpad)}
        ${dpadButton('on', t(lang, 'ui.on'), settings.dpad)}
        ${dpadButton('off', t(lang, 'ui.off'), settings.dpad)}
      </div>
    </div>
  `;
}

function langButton(value: Lang, label: string, current: Lang): string {
  const active = value === current ? ' settings__btn--active' : '';
  return `<button class="settings__btn${active}" data-set-lang="${value}" aria-pressed="${value === current}">${label}</button>`;
}

function dpadButton(value: DpadMode, label: string, current: DpadMode): string {
  const active = value === current ? ' settings__btn--active' : '';
  return `<button class="settings__btn${active}" data-set-dpad="${value}" aria-pressed="${value === current}">${label}</button>`;
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
