import type { Dir, Intent } from '../core/types';

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

export function intentFromKey(event: KeyboardEvent): Intent | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const dir = KEY_TO_DIR[event.key];
  if (dir) return { type: 'move', dir };

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
