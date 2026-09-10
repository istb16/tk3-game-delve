import type { Lang } from '../storage/settings';
import { t } from './i18n';
import { spriteToStandaloneSvg } from './pixel';
import { PLAYER } from './sprites';

/**
 * 起動時のタイトルスプラッシュ。
 *
 * `state.phase` を増やさず、DOM だけで完結させる。スプラッシュはゲームルールでは
 * なく見せ方なので、`Phase` に足すと `game/turn.ts` と `intentFromKey` に
 * ゲームと無関係な分岐が増える。
 *
 * 要素は `#app` の**外**（body 直下）に生やす。`render()` は毎ターン
 * `root.innerHTML` を作り直すので、中に入れると再描画で消えるか、
 * 消さないための状態を UI に抱えることになる。
 */

/** 出しっぱなしにする時間。Issue #1 の「3秒くらい」。 */
export const SPLASH_MS = 3000;

/** 消えるときのフェード。CSS の transition と同じ値でなければ描画が飛ぶ。 */
export const FADE_MS = 260;

export function installSplash(lang: Lang): void {
  const element = document.createElement('div');
  element.className = 'splash';
  // 作者名とバージョンは表示言語に関係なく同じ表記。バージョンの出典は
  // package.json だけ（vite.config.ts の define が置き換える）。
  element.innerHTML = `
    <div class="splash__inner">
      <div class="splash__mark" aria-hidden="true">${spriteToStandaloneSvg(PLAYER, 0, 'none')}</div>
      <h1 class="splash__title">DELVE</h1>
      <p class="splash__tagline">${t(lang, 'ui.tagline')}</p>
      <p class="splash__credit">Created by istb16<span class="splash__version">v${__APP_VERSION__}</span></p>
    </div>
  `;
  document.body.appendChild(element);

  let done = false;

  /**
   * 解除はこの1関数だけを通す。
   * タイマー・スキップ・二重呼びで経路が分かれると、リスナやタイマーが
   * 片方の経路だけ残る（CLAUDE.md 境界8「解除を1箇所に寄せる」）。
   */
  function dismiss(): void {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    element.classList.add('splash--out');
    setTimeout(() => element.remove(), FADE_MS);
  }

  /**
   * スキップの入力はここで食い止める。
   *
   * **capture フェーズで伝播を止める**ので、`main.ts` が window のバブル
   * フェーズに張っているゲームのハンドラには届かない。これで「盤面が
   * 見えないうちに1歩動いていた」を防ぎつつ、main.ts 側にスプラッシュ用の
   * 分岐を持ち込まずに済む。
   *
   * `stopImmediatePropagation` まで呼ぶ必要がある。イベントの target が
   * window 自身の場合（合成イベント）、capture と bubble の区別がなく
   * 登録順で呼ばれるため、`stopPropagation` だけでは同じ window に
   * 張られたゲームのハンドラを止められない。
   */
  function onKeyDown(event: KeyboardEvent): void {
    // 修飾キー付きはブラウザのショートカット（リロード等）なので、
    // 打ち消さずに素通りさせる。スプラッシュは消す。
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    dismiss();
  }

  function onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dismiss();
  }

  const timer = setTimeout(dismiss, SPLASH_MS);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, true);
}
