import type { Dir, Intent, Phase, Vec2 } from '../core/types';
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
  if (value === 'up' || value === 'down' || value === 'left' || value === 'right') {
    return { type: 'move', dir: value };
  }
  return null;
}

/** 盤面の矩形。DOM の DOMRect から必要な4つだけを受け取る（テストで DOM を要らなくする）。 */
export interface BoardRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 画面座標を盤面のマスに変換する。
 *
 * 盤面は `viewBox="0 0 width height"` の正方 SVG を CSS で伸縮させているだけなので、
 * 矩形を等分するだけでマスが出る。範囲外（枠の縁）は null。
 */
export function boardCellFromPoint(
  rect: BoardRect,
  point: { readonly x: number; readonly y: number },
  width: number,
  height: number,
): Vec2 | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((point.x - rect.left) / rect.width) * width);
  const y = Math.floor(((point.y - rect.top) / rect.height) * height);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}

/**
 * 盤面のタップを Intent に変換する。
 *
 * 押したマスへ直接ワープするのではなく、**プレイヤーから見た方向へ 1 歩**進む。
 * 移動は1マスずつというルールを変えずに、指で押せる的を盤面いっぱいまで広げられる
 * （1マスは iPhone の縦画面で 24px 前後しかなく、隣接マスだけを的にすると小さすぎる）。
 *
 * 斜めのタップは大きい方の成分を採る。同じだけ離れているときは横を優先する —
 * どちらでもよいが、経路ごとに違う向きになる方が操作を読めなくする。
 *
 * 自分のマスをタップしたら待機。方向パッドの中央ボタンを置き換える操作なので、
 * 「動かないことを選ぶ」手段は必ず残す。
 */
export function intentFromBoardTap(player: Vec2, cell: Vec2): Intent {
  const dx = cell.x - player.x;
  const dy = cell.y - player.y;
  if (dx === 0 && dy === 0) return { type: 'wait' };
  if (Math.abs(dx) >= Math.abs(dy)) return { type: 'move', dir: dx > 0 ? 'right' : 'left' };
  return { type: 'move', dir: dy > 0 ? 'down' : 'up' };
}
