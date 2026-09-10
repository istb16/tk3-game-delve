import type { LogEntry } from '../core/types';
import type { Lang } from '../storage/settings';
import type { MessageKey } from './i18n';
import { t } from './i18n';
import { isAchievementId } from '../data/achievements';
import { ITEMS } from '../data/items';

/**
 * ログ1行を表示用の文字列にする。
 *
 * `game/` は表示言語を知らないので、ログには**識別子だけ**が入っている
 * （拾ったアイテムの `itemId`、解除した実績の `id` など）。
 * それを名前に引き当てるのは `ui/` の仕事。
 *
 * ここを通さずに `t()` を直接呼ぶと、`{item}` や `{name}` が
 * そのまま画面に出る。実際に「スクロールを拾ったのに Potion と出る」
 * 「実績解除: {name} と出る」という形で2回やっている。
 */
export function formatLogEntry(lang: Lang, entry: LogEntry): string {
  return t(lang, entry.key, resolveParams(lang, entry));
}

const ITEM_IDS: ReadonlySet<string> = new Set(ITEMS.map((i) => i.id));

function resolveParams(
  lang: Lang,
  entry: LogEntry,
): Readonly<Record<string, string | number>> {
  const params = entry.params;
  const resolved: Record<string, string | number> = { ...params };

  // 識別子として渡ってくる値を、表示名に置き換える。
  // 名前をそのまま渡す経路（敵の name など）はそのまま通す。
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string') continue;

    if (key === 'item' && ITEM_IDS.has(value)) {
      resolved[key] = t(lang, `item.${value}` as MessageKey);
    } else if (key === 'id' && isAchievementId(value)) {
      // 実績のログは名前を {name} で参照している
      resolved['name'] = t(lang, `ach.${value}` as MessageKey);
    }
  }
  return resolved;
}
