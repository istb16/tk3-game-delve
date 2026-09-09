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
