import type { LogEntry, LogTone } from './types';
import { MAX_LOG } from './constants';

let nextId = 0;

/** ログを追加する。上限を超えたら古いものから捨てる。 */
export function addLog(log: LogEntry[], text: string, tone: LogTone = 'info'): void {
  log.push({ id: nextId++, text, tone });
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
}
