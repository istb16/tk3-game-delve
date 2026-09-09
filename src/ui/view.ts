import type { GameState, PerkId, Slot } from '../core/types';
import type { Settings } from '../storage/settings';
import type { SaveData } from '../storage/save';
import { computeScore } from '../storage/save';
import { renderBoard } from './board';
import { renderHud } from './hud';
import { t } from './i18n';
import { itemSpriteId } from './sprites';

export interface ViewContext {
  settings: Settings;
  save: SaveData;
}

/** ルート描画。状態を読んで画面を組み立てるだけで、状態を書き換えない。 */
export function render(root: HTMLElement, state: GameState, ctx: ViewContext): void {
  const { settings } = ctx;
  root.innerHTML = `
    ${renderHud(state, settings)}
    <main class="stage">
      <div class="stage__board">${renderBoard(state, settings)}</div>
      <aside class="stage__side">
        ${renderEquipment(state, settings)}
        ${renderItems(state, settings)}
        ${renderPerks(state, settings)}
        ${renderLog(state, settings)}
      </aside>
    </main>
    <footer class="hint">
      <span class="hint__keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd> ${t(settings.lang, 'ui.move')}</span>
      <span>${t(settings.lang, 'ui.motto')}</span>
    </footer>
    ${renderDpad(settings)}
    ${state.phase === 'levelup' ? renderLevelUpModal(state, settings) : ''}
    ${state.phase === 'dead' ? renderDeathModal(state, ctx) : ''}
  `;

  // innerHTML で挿入した要素の autofocus は効かないため明示的に当てる。
  // キーボードだけで「死ぬ -> すぐ次の Run」まで回せることを保証する。
  if (state.phase === 'dead') {
    root.querySelector<HTMLButtonElement>('[data-action="restart"]')?.focus();
  } else if (state.phase === 'levelup') {
    root.querySelector<HTMLButtonElement>('[data-choose]')?.focus();
  }
}

// --- パネル ------------------------------------------------------------------

const SLOTS: readonly Slot[] = ['weapon', 'armor', 'ring'];

function renderEquipment(state: GameState, settings: Settings): string {
  const rows = SLOTS.map((slot) => {
    const item = state.player.equipment[slot];
    const name = item ? item.name : t(settings.lang, 'ui.empty');
    const modifier = item ? ` gear__name--${item.rarity}` : ' gear__name--empty';
    return (
      `<li class="gear">` +
      `<svg class="gear__icon" viewBox="0 0 1 1" shape-rendering="crispEdges" aria-hidden="true">` +
      `<use href="#sp-${slot}-0" width="1" height="1"/></svg>` +
      `<span class="gear__slot">${t(settings.lang, `slot.${slot}` as const)}</span>` +
      `<span class="gear__name${modifier}">${escapeHtml(name)}</span>` +
      `</li>`
    );
  }).join('');
  return `<section class="panel"><h2 class="panel__title">${t(settings.lang, 'ui.equipment')}</h2><ul class="gear__list">${rows}</ul></section>`;
}

/**
 * インベントリ。数字キーとクリックの両方で使える。
 * 空きスロットも描くことで「何個持てるか」を常に見せる。
 */
function renderItems(state: GameState, settings: Settings): string {
  const slots = state.player.inventory
    .map((stack, index) => {
      const key = index + 1;
      if (!stack) {
        return `<li class="slot slot--empty"><span class="slot__key">${key}</span></li>`;
      }
      const label = t(settings.lang, 'aria.useItem', {
        item: t(settings.lang, `item.${stack.itemId}` as const),
        slot: key,
        count: stack.count,
      });
      return (
        `<li class="slot"><button class="slot__btn" data-use-slot="${index}" aria-label="${escapeHtml(label)}">` +
        `<span class="slot__key">${key}</span>` +
        `<svg class="slot__icon" viewBox="0 0 1 1" shape-rendering="crispEdges" aria-hidden="true">` +
        `<use href="#${itemSpriteId(stack.itemId)}" width="1" height="1"/></svg>` +
        `<span class="slot__count">${stack.count}</span>` +
        `</button></li>`
      );
    })
    .join('');
  return `<section class="panel"><h2 class="panel__title">${t(settings.lang, 'ui.items')}</h2><ul class="items__list">${slots}</ul></section>`;
}

/** 取得済みのパーク。同じものを重ねて取れるので個数をまとめて出す。 */
function renderPerks(state: GameState, settings: Settings): string {
  if (state.player.perks.length === 0) return '';

  const counts = new Map<PerkId, number>();
  for (const perk of state.player.perks) counts.set(perk, (counts.get(perk) ?? 0) + 1);

  const tags = [...counts.entries()]
    .map(([perk, count]) => {
      const name = escapeHtml(t(settings.lang, `perk.${perk}` as const));
      const badge = count > 1 ? `<span class="perk__count">&times;${count}</span>` : '';
      return `<li class="perk">${name}${badge}</li>`;
    })
    .join('');
  return `<section class="panel"><h2 class="panel__title">${t(settings.lang, 'ui.perks')}</h2><ul class="perk__list">${tags}</ul></section>`;
}

function renderLog(state: GameState, settings: Settings): string {
  // 末尾が最新。新しいものを上に出すと視線が飛ぶので、下から積み上げる。
  const items = state.log
    .slice(-10)
    .map(
      (entry) =>
        `<li class="log__line log__line--${entry.tone}">${escapeHtml(
          t(settings.lang, entry.key, entry.params),
        )}</li>`,
    )
    .join('');
  return `<section class="panel log"><h2 class="panel__title">${t(settings.lang, 'ui.log')}</h2><ul class="log__list">${items}</ul></section>`;
}

/**
 * 方向パッド。表示可否は settings.dpad と CSS のメディアクエリで決まる（→ main.css）。
 * 'auto' のときだけ画面サイズとポインタ種別で自動判定する。
 */
function renderDpad(settings: Settings): string {
  const lang = settings.lang;
  const btn = (dir: string, label: string, glyph: string) =>
    `<button class="dpad__btn dpad__btn--${dir}" data-dir="${dir}" aria-label="${label}">${glyph}</button>`;

  return `
    <nav class="dpad" aria-label="${t(lang, 'ui.move')}">
      ${btn('up', t(lang, 'aria.moveUp'), '&uarr;')}
      ${btn('left', t(lang, 'aria.moveLeft'), '&larr;')}
      ${btn('wait', t(lang, 'aria.wait'), '&bull;')}
      ${btn('right', t(lang, 'aria.moveRight'), '&rarr;')}
      ${btn('down', t(lang, 'aria.moveDown'), '&darr;')}
    </nav>
  `;
}

// --- モーダル ----------------------------------------------------------------

function renderLevelUpModal(state: GameState, settings: Settings): string {
  const choice = state.pendingChoices[0];
  if (!choice) return '';
  const lang = settings.lang;

  const options = choice.options
    .map((perk, index) => {
      const name = escapeHtml(t(lang, `perk.${perk}` as const));
      const desc = escapeHtml(t(lang, `perkDesc.${perk}` as const));
      return (
        `<button class="choice" data-choose="${index}">` +
        `<span class="choice__key">${index + 1}</span>` +
        `<span class="choice__name">${name}</span>` +
        `<span class="choice__desc">${desc}</span>` +
        `</button>`
      );
    })
    .join('');

  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <div class="modal__panel modal__panel--wide">
        <h2 class="modal__title modal__title--good" id="levelup-title">${t(lang, 'ui.levelUp')}</h2>
        <p class="modal__lead">${t(lang, 'ui.choosePerk', { level: choice.level })}</p>
        <div class="choices">${options}</div>
      </div>
    </div>
  `;
}

function renderDeathModal(state: GameState, ctx: ViewContext): string {
  const { settings, save } = ctx;
  const elapsed = Math.max(0, Date.now() - state.stats.startedAt);
  const score = computeScore(state);
  const bestScore = Math.max(save.bestScore, score);
  const bestDepth = Math.max(save.bestDepth, state.stats.deepestFloor);
  const isBest = score > 0 && score >= bestScore;

  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="death-title">
      <div class="modal__panel">
        <h2 class="modal__title" id="death-title">YOU DIED</h2>
        <dl class="result">
          ${resultRow('DEPTH', `FLOOR ${state.stats.deepestFloor}`)}
          ${resultRow('KILLS', String(state.stats.kills))}
          ${resultRow('GOLD', String(state.stats.goldEarned))}
          ${resultRow('LEVEL', String(state.player.level))}
          ${resultRow('TIME', formatDuration(elapsed))}
          ${resultRow(
            t(settings.lang, 'ui.score'),
            String(score),
            isBest ? t(settings.lang, 'ui.newBest') : '',
          )}
        </dl>
        <p class="result__best">${t(settings.lang, 'ui.best')} &middot; FLOOR ${bestDepth} &middot; ${bestScore}</p>
        <button class="btn btn--primary" data-action="restart">DELVE AGAIN</button>
        <p class="modal__hint">${t(settings.lang, 'ui.pressEnter', { key: 'Enter' })}</p>
      </div>
    </div>
  `;
}

/** リザルトの見出しは HUD と揃えて英語のまま（→ i18n.ts の方針）。 */
function resultRow(label: string, value: string, badge = ''): string {
  const mark = badge ? `<span class="result__badge">${escapeHtml(badge)}</span>` : '';
  return `<div class="result__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}${mark}</dd></div>`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
