import type { LogEntry } from '../core/types';
import type { Lang } from '../storage/settings';
import { formatLogEntry } from './logline';
import { escapeHtml } from './view';

/**
 * 画面の右上に短く流すメッセージ。
 *
 * 狭い画面ではログのパネルがタブの裏に隠れる。隠れている間に起きたことが
 * どこにも出ないと、「何に殴られて減ったのか」がプレイヤーに届かない。
 * ログを読みに行かなくても直近の出来事だけは目に入るようにする。
 *
 * 要素は `#app` の**外**（body 直下）に生やす。`render()` は毎ターン
 * `root.innerHTML` を作り直すので、中に入れると次の1手で消えてしまう
 * （スプラッシュと同じ理由 → splash.ts）。
 */

/** 1件を出しておく時間。 */
export const TOAST_MS = 5000;

/** 消えるときのフェード。CSS の transition と同じ値でなければ描画が飛ぶ。 */
export const TOAST_FADE_MS = 220;

/**
 * 同時に積んでおく上限。
 *
 * 1ターンに「会心 → 撃破 → レベルアップ」と3件並ぶことがあり、
 * 上限がないと戦闘中に画面の右半分が文字で埋まる。
 */
export const TOAST_MAX = 4;

export interface ToastLine {
  readonly text: string;
  readonly tone: LogEntry['tone'];
}

/**
 * 積むべき行を選ぶ。
 *
 * **新しい方から** `max` 件だけ残す。1ターンにまとめて起きた場合、
 * 古い方を出しても上限を超えて即座に押し出されるだけで誰も読めない。
 */
export function toastLines(
  entries: readonly LogEntry[],
  lang: Lang,
  max: number = TOAST_MAX,
): ToastLine[] {
  return entries.slice(-max).map((entry) => ({
    text: formatLogEntry(lang, entry),
    tone: entry.tone,
  }));
}

/** 積み場所。最初に必要になった時だけ作る。 */
function stack(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('.toasts');
  if (existing) return existing;

  const element = document.createElement('div');
  element.className = 'toasts';
  // 読み上げは「今起きたこと」として流す。焦点は動かさない。
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  document.body.appendChild(element);
  return element;
}

/**
 * 1件を消す。表示時間切れと、上限による押し出しの両方がここを通る。
 *
 * 解除は必ずこの1関数を通す。経路が分かれると、タイマーだけが残った要素と
 * 要素だけが残ったタイマーが混ざる（CLAUDE.md 境界8「解除を1箇所に寄せる」）。
 */
function dismiss(element: HTMLElement, timer: number): void {
  if (element.dataset['out'] === 'true') return;
  element.dataset['out'] = 'true';
  clearTimeout(timer);
  element.classList.add('toast--out');
  setTimeout(() => element.remove(), TOAST_FADE_MS);
}

/** 新しいログを右上に流す。呼ぶ側が「ログが隠れているか」を決める。 */
export function showToasts(entries: readonly LogEntry[], lang: Lang): void {
  const lines = toastLines(entries, lang);
  if (lines.length === 0) return;

  const container = stack();
  for (const line of lines) {
    const element = document.createElement('div');
    element.className = `toast toast--${line.tone}`;
    element.innerHTML = escapeHtml(line.text);
    container.appendChild(element);

    const timer = window.setTimeout(() => dismiss(element, timer), TOAST_MS);
    element.dataset['timer'] = String(timer);
  }

  // 上限を超えた分は古い方から押し出す。
  const all = [...container.querySelectorAll<HTMLElement>('.toast:not(.toast--out)')];
  for (const old of all.slice(0, Math.max(0, all.length - TOAST_MAX))) {
    dismiss(old, Number(old.dataset['timer'] ?? 0));
  }
}

/**
 * ログのパネルが画面に出ているか。
 *
 * 画面幅ではなく**実際に描かれているか**で見る。表示条件は CSS の
 * メディアクエリとタブが決めており、同じ条件を JS に書き写すと、
 * 片方だけ変えたときに黙ってずれる。
 */
export function isLogVisible(root: ParentNode): boolean {
  const panel = root.querySelector('.side__group--log');
  return panel !== null && panel.getClientRects().length > 0;
}
