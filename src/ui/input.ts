import type { Dir, Intent, Phase } from '../core/types';

/**
 * 生の入力イベントを Intent に変換する。
 * game/ 側がキーバインドやタッチ操作を知らずに済むよう、ここで吸収する。
 */

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

/**
 * ゲームの操作に使うキーかどうか。
 *
 * モーダル表示中に矢印やスペースを素通りさせると、背後のページがスクロールしてしまう。
 * 意味を持たない場面でも「ゲームのキー」であることは分かる必要がある。
 */
export function isGameKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (KEY_TO_DIR[event.key]) return true;
  if (event.key >= '0' && event.key <= '9') return true;
  return event.key === '.' || event.key === ' ' || event.key === 'Enter';
}

/**
 * 数字キーの意味は phase で変わる。
 * 選択待ちの間は選択肢、それ以外はインベントリのスロット。
 * game/ 側に phase 分岐を持たせず、入力の解釈をここに閉じ込める。
 */
export function intentFromKey(event: KeyboardEvent, phase: Phase): Intent | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  if (phase === 'choosing') {
    if (event.key >= '1' && event.key <= '9') {
      return { type: 'choose', index: Number(event.key) - 1 };
    }
    // 選択待ちの間は移動も待機もできない
    return null;
  }

  const dir = KEY_TO_DIR[event.key];
  if (dir) return { type: 'move', dir };

  // 数字キーでインベントリのスロットを使う
  if (event.key >= '1' && event.key <= '8') {
    return { type: 'useItem', slot: Number(event.key) - 1 };
  }

  if (event.key === '.' || event.key === ' ') return { type: 'wait' };
  if (event.key === 'Enter') return { type: 'restart' };
  return null;
}

export function intentFromDpad(value: string): Intent | null {
  if (value === 'wait') return { type: 'wait' };
  if (value === 'up' || value === 'down' || value === 'left' || value === 'right') {
    return { type: 'move', dir: value };
  }
  return null;
}
