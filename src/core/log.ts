import type { LogEntry, LogKey, LogTone } from './types';
import { MAX_LOG } from './constants';

let nextId = 0;

/**
 * ログを追加する。上限を超えたら古いものから捨てる。
 *
 * ここで受け取るのは表示用の文章ではなくメッセージ識別子とパラメータ。
 * 文章への組み立ては ui/ が表示言語に応じて行う。
 */
export function addLog(
  log: LogEntry[],
  key: LogKey,
  params: Readonly<Record<string, string | number>> = {},
  tone: LogTone = 'info',
): void {
  log.push({ id: nextId++, key, params, tone });
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
}

/**
 * 直前とまったく同じメッセージなら積まない。
 *
 * ターンを消費しない操作（空スロットを押す等）は何度でも繰り返せるため、
 * そのたびにログを積むと表示中の12行が全部それで埋まり、
 * 直前の戦闘ログが押し出されて読めなくなる。
 */
export function addLogOnce(
  log: LogEntry[],
  key: LogKey,
  params: Readonly<Record<string, string | number>> = {},
  tone: LogTone = 'info',
): void {
  const last = log[log.length - 1];
  if (last && last.key === key && sameParams(last.params, params)) return;
  addLog(log, key, params, tone);
}

function sameParams(
  a: Readonly<Record<string, string | number>>,
  b: Readonly<Record<string, string | number>>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}
