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
  | 'log.alreadyFull'
  | 'log.descendHeal'
  | 'log.critical'
  | 'log.evaded'
  | 'log.lifesteal'
  | 'log.thorns'
  | 'log.pickupGold'
  | 'log.openChest'
  | 'log.equip'
  | 'log.equipWorse'
  | 'log.useBomb'
  | 'log.bombDud'
  | 'log.perkTaken'
  | 'log.equipKept'
  | 'log.newBest'
  // UI
  | 'ui.tagline'
  | 'ui.log'
  | 'ui.items'
  | 'ui.equipment'
  | 'ui.perks'
  | 'ui.empty'
  | 'ui.levelUp'
  | 'ui.choosePerk'
  | 'ui.swapGear'
  | 'ui.chooseGear'
  | 'ui.takeNew'
  | 'ui.keepCurrent'
  | 'ui.current'
  | 'ui.score'
  | 'ui.best'
  | 'ui.newBest'
  | 'item.potion'
  | 'item.bomb'
  | 'slot.weapon'
  | 'slot.armor'
  | 'slot.ring'
  | 'perk.sharpened'
  | 'perk.vitality'
  | 'perk.deadlyAim'
  | 'perk.ironhide'
  | 'perk.lifesteal'
  | 'perk.treasureSense'
  | 'perk.swiftStep'
  | 'perkDesc.sharpened'
  | 'perkDesc.vitality'
  | 'perkDesc.deadlyAim'
  | 'perkDesc.ironhide'
  | 'perkDesc.lifesteal'
  | 'perkDesc.treasureSense'
  | 'perkDesc.swiftStep'
  | 'aria.useItem'
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
  'log.pickup': 'Picked up {count} Potion.',
  'log.inventoryFull': 'Your pack is full.',
  'log.usePotion': 'You drink a Potion. (+{healed} HP)',
  'log.emptySlot': 'Slot {slot} is empty.',
  'log.alreadyFull': 'You are already at full health.',
  'log.descendHeal': 'You catch your breath. (+{healed} HP)',
  'log.critical': 'CRITICAL! You hit {name} for {damage}.',
  'log.evaded': 'You dodge {name}.',
  'log.lifesteal': 'You drain {healed} HP.',
  'log.thorns': 'Thorns bite {name} for {damage}.',
  'log.pickupGold': 'Picked up {amount} gold.',
  'log.openChest': 'You open the chest.',
  'log.equip': 'You equip {name}.',
  'log.equipWorse': '{name} is worse than what you carry.',
  'log.useBomb': 'The bomb blasts {hits} enemies and {broken} walls.',
  'log.bombDud': 'Nothing here to blow up.',
  'log.perkTaken': 'You gain {perk}.',
  'log.equipKept': 'You leave {name} on the floor.',
  'log.newBest': 'NEW BEST! FLOOR {floor}',

  'ui.equipment': 'EQUIPMENT',
  'ui.perks': 'PERKS',
  'ui.empty': 'empty',
  'ui.levelUp': 'LEVEL UP',
  'ui.choosePerk': 'You are now LV {level}. Choose one.',
  'ui.swapGear': 'SWAP GEAR?',
  'ui.chooseGear': 'Neither is strictly better. Pick the one your build wants.',
  'ui.takeNew': 'Take {name}',
  'ui.keepCurrent': 'Keep {name}',
  'ui.current': 'equipped',
  'ui.score': 'SCORE',
  'ui.best': 'BEST',
  'ui.newBest': 'NEW BEST',
  'item.bomb': 'Bomb',
  'slot.weapon': 'Weapon',
  'slot.armor': 'Armor',
  'slot.ring': 'Ring',
  'perk.sharpened': 'Sharpened',
  'perk.vitality': 'Vitality',
  'perk.deadlyAim': 'Deadly Aim',
  'perk.ironhide': 'Ironhide',
  'perk.lifesteal': 'Lifesteal',
  'perk.treasureSense': 'Treasure Sense',
  'perk.swiftStep': 'Swift Step',
  'perkDesc.sharpened': 'Attack +10%',
  'perkDesc.vitality': 'Max HP +15, heal to full',
  'perkDesc.deadlyAim': 'Critical +10%',
  'perkDesc.ironhide': 'Defense +2',
  'perkDesc.lifesteal': 'Drain 8% of damage dealt',
  'perkDesc.treasureSense': 'Sense chests and gold you have seen',
  'perkDesc.swiftStep': '25% of steps cost no turn',

  'ui.tagline': 'Go deeper. Survive longer.',
  'ui.log': 'LOG',
  'ui.items': 'ITEMS',
  'item.potion': 'Potion',
  'aria.useItem': 'Use {item}, slot {slot}, {count} left',
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
  'log.pickup': 'Potion を {count} 個拾った。',
  'log.inventoryFull': '荷物がいっぱいだ。',
  'log.usePotion': 'Potion を飲んだ。(+{healed} HP)',
  'log.emptySlot': 'スロット {slot} は空だ。',
  'log.alreadyFull': 'HP は満タンだ。',
  'log.descendHeal': '一息ついた。(+{healed} HP)',
  'log.critical': 'かいしんの一撃! {name} に {damage} のダメージ。',
  'log.evaded': '{name} の攻撃をかわした。',
  'log.lifesteal': 'HP を {healed} 吸収した。',
  'log.thorns': '棘が {name} に {damage} のダメージ。',
  'log.pickupGold': 'ゴールドを {amount} 手に入れた。',
  'log.openChest': '宝箱を開けた。',
  'log.equip': '{name} を装備した。',
  'log.equipWorse': '{name} は今の装備より弱い。',
  'log.useBomb': '爆風が敵 {hits} 体と壁 {broken} 枚を巻き込んだ。',
  'log.bombDud': 'ここで爆破しても何も起きない。',
  'log.perkTaken': '{perk} を習得した。',
  'log.equipKept': '{name} は床に置いていった。',
  'log.newBest': '自己ベスト更新! FLOOR {floor}',

  'ui.equipment': 'EQUIPMENT',
  'ui.perks': 'PERKS',
  'ui.empty': 'なし',
  'ui.levelUp': 'LEVEL UP',
  'ui.choosePerk': 'LV {level} になった。1つ選べ。',
  'ui.swapGear': '持ち替えるか?',
  'ui.chooseGear': 'どちらが上位ということはない。ビルドに合う方を選べ。',
  'ui.takeNew': '{name} に持ち替える',
  'ui.keepCurrent': '{name} のままにする',
  'ui.current': '装備中',
  'ui.score': 'SCORE',
  'ui.best': 'BEST',
  'ui.newBest': '自己ベスト',
  'item.bomb': 'Bomb',
  'slot.weapon': '武器',
  'slot.armor': '防具',
  'slot.ring': '指輪',
  'perk.sharpened': 'Sharpened',
  'perk.vitality': 'Vitality',
  'perk.deadlyAim': 'Deadly Aim',
  'perk.ironhide': 'Ironhide',
  'perk.lifesteal': 'Lifesteal',
  'perk.treasureSense': 'Treasure Sense',
  'perk.swiftStep': 'Swift Step',
  'perkDesc.sharpened': '攻撃力 +10%',
  'perkDesc.vitality': '最大HP +15、全回復',
  'perkDesc.deadlyAim': 'クリティカル率 +10%',
  'perkDesc.ironhide': '防御力 +2',
  'perkDesc.lifesteal': '与ダメージの 8% を吸収',
  'perkDesc.treasureSense': '一度見た宝箱とゴールドを表示',
  'perkDesc.swiftStep': '25% の確率で移動がターンを消費しない',

  'ui.tagline': 'より深く。より長く生き延びろ。',
  'ui.log': 'LOG',
  'ui.items': 'ITEMS',
  'item.potion': 'Potion',
  'aria.useItem': '{item} を使う（スロット {slot}、残り {count}）',
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
