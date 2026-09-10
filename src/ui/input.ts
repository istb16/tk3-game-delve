import type { Dir, Intent, Phase } from '../core/types';
import { INVENTORY_SIZE } from '../core/constants';

/**
 * 生の入力イベントを Intent に変換する。
 * game/ 側がキーバインドやタッチ操作を知らずに済むよう、ここで吸収する。
 */

/**
 * 数字キーで指せるスロットの数。
 * インベントリのスロット数から引く — 別の数値を書くと、
 * スロットを増やしたときにキーだけ古いままになる。
 */
const INVENTORY_KEYS = INVENTORY_SIZE;

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
  if (/^Digit[0-9]$/.test(event.code)) return true;
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

  // 数字は event.key ではなく event.code で見る。
  //
  // どのキーがどの文字になるかはキーボード配列で変わる。
  // AZERTY では数字段を素で押すと '&' や 'é' になり、数字を出すには Shift が要る。
  // US でも Shift+1 は '!' になる。key で判定すると、配列によって
  // アイテムが使えない・捨てられないという壊れ方をする。
  const digit = /^Digit([0-9])$/.exec(event.code);
  const slot = digit ? Number(digit[1]) : null;

  if (phase === 'choosing') {
    // Shift の有無は問わない。モーダルで番号を押した意図は同じ。
    if (slot !== null && slot >= 1) return { type: 'choose', index: slot - 1 };
    // 選択待ちの間は移動も待機もできない
    return null;
  }

  // Shift + 数字で捨てる
  if (event.shiftKey) {
    if (slot !== null && slot >= 1 && slot <= INVENTORY_KEYS) {
      return { type: 'dropItem', slot: slot - 1 };
    }
    // Shift + その他は何もしない（大文字の WASD で意図せず動かないように）
    return null;
  }

  const dir = KEY_TO_DIR[event.key];
  if (dir) return { type: 'move', dir };

  // 数字キーでインベントリのスロットを使う
  if (slot !== null && slot >= 1 && slot <= INVENTORY_KEYS) {
    return { type: 'useItem', slot: slot - 1 };
  }

  if (event.key === '.' || event.key === ' ') return { type: 'wait' };
  if (event.key === 'Enter') return { type: 'restart' };
  return null;
}


/**
 * スロットを押したときの解決。
 *
 * ホバーできる環境（マウス）では、名前と効果はホバーで読めるので押したら即使用。
 * ホバーできない環境（タッチ）では、1回目のタップで選択して説明を出し、
 * 同じスロットをもう一度タップして初めて使う。
 *
 * タッチで即使用にすると、何のアイテムか確かめる手段が「使ってみる」しかなくなる。
 * 回復も爆弾も1個ずつしかないことがあるので、確かめるために失うのは重すぎる。
 */
export type SlotAction = { type: 'select'; slot: number } | { type: 'use'; slot: number };

export function resolveSlotTap(
  slot: number,
  selected: number | null,
  needsConfirm: boolean,
): SlotAction {
  if (!needsConfirm) return { type: 'use', slot };
  return selected === slot ? { type: 'use', slot } : { type: 'select', slot };
}

/**
 * ホバーできない環境か。
 *
 * 画面幅ではなくポインタの性質で判定する。タッチ対応のノートPCのように
 * 「狭くないがタッチもできる」端末で誤判定しないため。
 */
export function isHoverless(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: none)').matches;
}

export function intentFromDpad(value: string): Intent | null {
  if (value === 'wait') return { type: 'wait' };
  if (value === 'up' || value === 'down' || value === 'left' || value === 'right') {
    return { type: 'move', dir: value };
  }
  return null;
}
