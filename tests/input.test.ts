import { describe, expect, it } from 'vitest';
import { boardCellFromPoint, intentFromBoardTap, intentFromDpad } from '../src/ui/input';

/**
 * 盤面タップの入力解決。
 *
 * ここが壊れるとスマートフォンで一切動けなくなるが、症状は「タップしても
 * 反応しない」という無言の壊れ方で、型でも実行時エラーでも表に出ない。
 */

const RECT = { left: 20, top: 100, width: 300, height: 300 };
const SIZE = 15;

describe('盤面の座標からマスを引く', () => {
  it('左上の角は (0, 0)', () => {
    expect(boardCellFromPoint(RECT, { x: 21, y: 101 }, SIZE, SIZE)).toEqual({ x: 0, y: 0 });
  });

  it('右下の角は最後のマス', () => {
    expect(boardCellFromPoint(RECT, { x: 319, y: 399 }, SIZE, SIZE)).toEqual({ x: 14, y: 14 });
  });

  it('マスの境界はちょうど次のマスに入る', () => {
    // 300px / 15 マス = 1マス 20px
    expect(boardCellFromPoint(RECT, { x: 20 + 20, y: 100 }, SIZE, SIZE)).toEqual({ x: 1, y: 0 });
  });

  it('枠の外は null（盤面の縁を押しても暴発しない）', () => {
    expect(boardCellFromPoint(RECT, { x: 19, y: 200 }, SIZE, SIZE)).toBeNull();
    expect(boardCellFromPoint(RECT, { x: 200, y: 401 }, SIZE, SIZE)).toBeNull();
  });

  it('潰れた矩形では null（描画前に押された場合に 0 除算しない）', () => {
    expect(boardCellFromPoint({ ...RECT, width: 0 }, { x: 20, y: 100 }, SIZE, SIZE)).toBeNull();
  });
});

describe('盤面タップの向き', () => {
  const player = { x: 7, y: 7 };

  it('離れたマスでもワープせず、その方向へ1歩だけ進む', () => {
    expect(intentFromBoardTap(player, { x: 14, y: 7 })).toEqual({ type: 'move', dir: 'right' });
    expect(intentFromBoardTap(player, { x: 0, y: 7 })).toEqual({ type: 'move', dir: 'left' });
    expect(intentFromBoardTap(player, { x: 7, y: 0 })).toEqual({ type: 'move', dir: 'up' });
    expect(intentFromBoardTap(player, { x: 7, y: 14 })).toEqual({ type: 'move', dir: 'down' });
  });

  it('斜めのタップは離れている方の軸を採る', () => {
    expect(intentFromBoardTap(player, { x: 10, y: 6 })).toEqual({ type: 'move', dir: 'right' });
    expect(intentFromBoardTap(player, { x: 6, y: 10 })).toEqual({ type: 'move', dir: 'down' });
  });

  it('ちょうど斜め45度は横を優先する（同じ入力で必ず同じ向きになる）', () => {
    expect(intentFromBoardTap(player, { x: 9, y: 9 })).toEqual({ type: 'move', dir: 'right' });
    expect(intentFromBoardTap(player, { x: 5, y: 5 })).toEqual({ type: 'move', dir: 'left' });
  });

  it('自分のマスをタップしたら待機（方向パッドの中央ボタンの代わり）', () => {
    expect(intentFromBoardTap(player, player)).toEqual({ type: 'wait' });
  });
});

describe('方向パッド', () => {
  it('4方向だけを受け付ける', () => {
    expect(intentFromDpad('up')).toEqual({ type: 'move', dir: 'up' });
    expect(intentFromDpad('down')).toEqual({ type: 'move', dir: 'down' });
    expect(intentFromDpad('left')).toEqual({ type: 'move', dir: 'left' });
    expect(intentFromDpad('right')).toEqual({ type: 'move', dir: 'right' });
  });

  it('中央の待機ボタンは廃止したので受け付けない', () => {
    expect(intentFromDpad('wait')).toBeNull();
    expect(intentFromDpad('')).toBeNull();
  });
});
