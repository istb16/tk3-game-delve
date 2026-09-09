import type { GameState } from '../core/types';
import { renderBoard } from './board';
import { renderHud } from './hud';

/** ルート描画。状態を読んで画面を組み立てるだけで、状態を書き換えない。 */
export function render(root: HTMLElement, state: GameState): void {
  root.innerHTML = `
    ${renderHud(state)}
    <main class="stage">
      <div class="stage__board">${renderBoard(state)}</div>
      <aside class="stage__side">
        ${renderLog(state)}
      </aside>
    </main>
    <footer class="hint">
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd> Move</span>
      <span>Explore. Fight. Descend.</span>
    </footer>
    ${renderDpad()}
    ${state.phase === 'dead' ? renderDeathModal(state) : ''}
  `;

  // innerHTML で挿入した要素の autofocus は効かないため明示的に当てる。
  // キーボードだけで「死ぬ -> すぐ次の Run」まで回せることを保証する。
  if (state.phase === 'dead') {
    root.querySelector<HTMLButtonElement>('[data-action="restart"]')?.focus();
  }
}

function renderLog(state: GameState): string {
  // 末尾が最新。新しいものを上に出すと視線が飛ぶので、下から積み上げる。
  const entries = state.log.slice(-12);
  const items = entries
    .map((entry) => `<li class="log__line log__line--${entry.tone}">${escapeHtml(entry.text)}</li>`)
    .join('');
  return `<section class="log"><h2 class="log__title">LOG</h2><ul class="log__list">${items}</ul></section>`;
}

function renderDpad(): string {
  return `
    <nav class="dpad" aria-label="Move">
      <button class="dpad__btn dpad__btn--up"    data-dir="up"    aria-label="Move up">&uarr;</button>
      <button class="dpad__btn dpad__btn--left"  data-dir="left"  aria-label="Move left">&larr;</button>
      <button class="dpad__btn dpad__btn--wait"  data-dir="wait"  aria-label="Wait">&bull;</button>
      <button class="dpad__btn dpad__btn--right" data-dir="right" aria-label="Move right">&rarr;</button>
      <button class="dpad__btn dpad__btn--down"  data-dir="down"  aria-label="Move down">&darr;</button>
    </nav>
  `;
}

function renderDeathModal(state: GameState): string {
  const elapsed = Math.max(0, Date.now() - state.stats.startedAt);
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="death-title">
      <div class="modal__panel">
        <h2 class="modal__title" id="death-title">YOU DIED</h2>
        <dl class="result">
          ${resultRow('DEPTH', `Floor ${state.stats.deepestFloor}`)}
          ${resultRow('KILLS', String(state.stats.kills))}
          ${resultRow('GOLD', String(state.stats.goldEarned))}
          ${resultRow('LEVEL', String(state.player.level))}
          ${resultRow('TIME', formatDuration(elapsed))}
        </dl>
        <button class="btn btn--primary" data-action="restart" autofocus>DELVE AGAIN</button>
        <p class="modal__hint">Press <kbd>Enter</kbd> to dive again</p>
      </div>
    </div>
  `;
}

function resultRow(label: string, value: string): string {
  return `<div class="result__row"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
