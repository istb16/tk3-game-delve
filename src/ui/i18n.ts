import type { Lang } from '../storage/settings';

/**
 * 表示文字列。
 *
 * 方針: **ステータスの見出しは英語のまま**、**文章と操作ラベルは訳す**。
 *   - 英語のまま: HP / FLOOR / EXP / GOLD / LV / DEPTH / KILLS / LEVEL / TIME / LOG
 *     短く、ゲームの文脈で意味が自明で、日本語にすると却って読み取りが遅くなる。
 *   - 訳す: ログの文章、ヒント、ボタン、設定ラベル、読み上げ用ラベル。
 *   - タイトル `DELVE` と `YOU DIED` / `DELVE AGAIN` は固有の表示なので英語のまま。
 *
 * 敵の名前（Rat / Goblin / Bat）も短い固有名詞なので両言語で英語のまま扱う。
 */

export type MessageKey =
  // ログ（game/ が構造化して積み、ここで文章にする）
  | 'log.welcome'
  | 'log.floor'
  | 'log.playerHit'
  | 'log.enemyHit'
  | 'log.enemyDies'
  | 'log.levelUp'
  | 'log.died'
  | 'log.pickup'
  | 'log.inventoryFull'
  | 'log.usePotion'
  | 'log.emptySlot'
  | 'log.descendHeal'
  // UI
  | 'ui.tagline'
  | 'ui.log'
  | 'ui.items'
  | 'ui.move'
  | 'ui.motto'
  | 'ui.pressEnter'
  | 'ui.settings'
  | 'ui.language'
  | 'ui.dpad'
  | 'ui.auto'
  | 'ui.on'
  | 'ui.off'
  | 'aria.board'
  | 'aria.moveUp'
  | 'aria.moveDown'
  | 'aria.moveLeft'
  | 'aria.moveRight'
  | 'aria.wait';

export type MessageParams = Readonly<Record<string, string | number>>;

const EN: Record<MessageKey, string> = {
  'log.welcome': 'You descend into the dark. Explore. Fight. Descend.',
  'log.floor': 'FLOOR {floor}',
  'log.playerHit': 'You hit {name} for {damage}.',
  'log.enemyHit': '{name} hits you for {damage}.',
  'log.enemyDies': '{name} dies. +{exp} EXP',
  'log.levelUp': 'LEVEL UP! You are now LV {level}. (+{healed} HP)',
  'log.died': 'You died.',
  'log.pickup': 'Picked up a Potion.',
  'log.inventoryFull': 'Your pack is full.',
  'log.usePotion': 'You drink a Potion. (+{healed} HP)',
  'log.emptySlot': 'Slot {slot} is empty.',
  'log.descendHeal': 'You catch your breath. (+{healed} HP)',

  'ui.tagline': 'Go deeper. Survive longer.',
  'ui.log': 'LOG',
  'ui.items': 'ITEMS',
  'ui.move': 'Move',
  'ui.motto': 'Explore. Fight. Descend.',
  'ui.pressEnter': 'Press {key} to dive again',
  'ui.settings': 'Settings',
  'ui.language': 'Language',
  'ui.dpad': 'D-Pad',
  'ui.auto': 'AUTO',
  'ui.on': 'ON',
  'ui.off': 'OFF',
  'aria.board': 'Dungeon map, FLOOR {floor}. You are at column {x}, row {y}.',
  'aria.moveUp': 'Move up',
  'aria.moveDown': 'Move down',
  'aria.moveLeft': 'Move left',
  'aria.moveRight': 'Move right',
  'aria.wait': 'Wait one turn',
};

const JA: Record<MessageKey, string> = {
  'log.welcome': '暗闇へと降りていく。探索し、戦い、さらに深く。',
  'log.floor': 'FLOOR {floor}',
  'log.playerHit': '{name} に {damage} のダメージを与えた。',
  'log.enemyHit': '{name} から {damage} のダメージを受けた。',
  'log.enemyDies': '{name} を倒した。+{exp} EXP',
  'log.levelUp': 'LEVEL UP! LV {level} になった。(+{healed} HP)',
  'log.died': '力尽きた。',
  'log.pickup': 'Potion を拾った。',
  'log.inventoryFull': '荷物がいっぱいだ。',
  'log.usePotion': 'Potion を飲んだ。(+{healed} HP)',
  'log.emptySlot': 'スロット {slot} は空だ。',
  'log.descendHeal': '一息ついた。(+{healed} HP)',

  'ui.tagline': 'より深く。より長く生き延びろ。',
  'ui.log': 'LOG',
  'ui.items': 'ITEMS',
  'ui.move': 'いどう',
  'ui.motto': '探索し、戦い、さらに深く。',
  'ui.pressEnter': '{key} でもう一度潜る',
  'ui.settings': '設定',
  'ui.language': '言語',
  'ui.dpad': '方向キー',
  'ui.auto': 'AUTO',
  'ui.on': 'ON',
  'ui.off': 'OFF',
  'aria.board': 'ダンジョンマップ FLOOR {floor}。現在地は左から {x} 番目、上から {y} 番目。',
  'aria.moveUp': '上に移動',
  'aria.moveDown': '下に移動',
  'aria.moveLeft': '左に移動',
  'aria.moveRight': '右に移動',
  'aria.wait': '1ターン待機',
};

const TABLES: Record<Lang, Record<MessageKey, string>> = { en: EN, ja: JA };

/** `{name}` 形式のプレースホルダを差し込んで文字列を返す。 */
export function t(lang: Lang, key: MessageKey, params: MessageParams = {}): string {
  const template = TABLES[lang][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
