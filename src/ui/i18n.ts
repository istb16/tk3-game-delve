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
  | 'log.useElixir'
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
  | 'log.poisoned'
  | 'log.burned'
  | 'log.slowed'
  | 'log.statusTick'
  | 'log.enemyEvaded'
  | 'log.guarded'
  | 'log.revived'
  | 'log.split'
  | 'log.enraged'
  | 'log.bossAppears'
  | 'log.shieldBlocked'
  | 'log.useScroll'
  | 'log.scrollBlast'
  | 'log.scrollReveal'
  | 'log.scrollTeleport'
  | 'log.scrollRage'
  | 'log.scrollBanish'
  | 'log.scrollCurse'
  | 'log.needKey'
  | 'log.useKey'
  | 'log.eventDeclined'
  | 'log.shrineBlessed'
  | 'log.merchantBought'
  | 'log.merchantPoor'
  | 'log.cursedReward'
  | 'log.cursedTrap'
  | 'log.springDrunk'
  | 'log.altarSwapped'
  | 'log.altarEmpty'
  | 'log.hiddenRoom'
  | 'log.treasuryTaken'
  | 'log.achievement'
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
  | 'item.elixir'
  | 'itemDesc.heal'
  | 'itemDesc.bomb'
  | 'itemDesc.scroll'
  | 'itemDesc.key'
  | 'ui.tapAgain'
  | 'ui.stack'
  | 'ui.stackFull'
  | 'item.scroll'
  | 'item.key'
  | 'perk.poisonAttack'
  | 'perk.fireDamage'
  | 'perk.shield'
  | 'perkDesc.poisonAttack'
  | 'perkDesc.fireDamage'
  | 'perkDesc.shield'
  | 'ui.status'
  | 'ui.achievements'
  | 'ui.sound'
  | 'ui.locked'
  | 'ui.unlocked'
  | 'ach.firstBlood'
  | 'ach.deepDiver'
  | 'ach.treasureHunter'
  | 'ach.slayer'
  | 'ach.bossKiller'
  | 'ach.centurion'
  | 'ach.floor10'
  | 'ach.floor25'
  | 'ach.floor50'
  | 'achDesc.firstBlood'
  | 'achDesc.deepDiver'
  | 'achDesc.treasureHunter'
  | 'achDesc.slayer'
  | 'achDesc.bossKiller'
  | 'achDesc.centurion'
  | 'achDesc.floor10'
  | 'achDesc.floor25'
  | 'achDesc.floor50'
  | 'aria.soundOn'
  | 'aria.soundOff'
  | 'ui.tabGear'
  | 'ui.tabLog'
  | 'status.poison'
  | 'status.burn'
  | 'status.slow'
  | 'status.rage'
  | 'status.guard'
  | 'event.shrine'
  | 'event.merchant'
  | 'event.cursedChest'
  | 'event.healingSpring'
  | 'event.strangeAltar'
  | 'event.hiddenRoom'
  | 'event.treasury'
  | 'eventLead.shrine'
  | 'eventLead.merchant'
  | 'eventLead.cursedChest'
  | 'eventLead.healingSpring'
  | 'eventLead.strangeAltar'
  | 'eventLead.hiddenRoom'
  | 'eventLead.treasury'
  | 'opt.shrine0'
  | 'opt.merchant0'
  | 'opt.merchant1'
  | 'opt.cursedChest0'
  | 'opt.healingSpring0'
  | 'opt.strangeAltar0'
  | 'opt.hiddenRoom0'
  | 'opt.treasury0'
  | 'opt.leave'
  | 'optDesc.shrine0'
  | 'optDesc.merchant0'
  | 'optDesc.merchant1'
  | 'optDesc.cursedChest0'
  | 'optDesc.healingSpring0'
  | 'optDesc.strangeAltar0'
  | 'optDesc.hiddenRoom0'
  | 'optDesc.treasury0'
  | 'optDesc.leave'
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
  'log.pickup': 'Picked up {item} x{count}.',
  'log.inventoryFull': 'Your pack is full.',
  'log.usePotion': 'You drink a Potion. (+{healed} HP)',
  'log.useElixir': 'You drain the Elixir. (+{healed} HP)',
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
  'log.poisoned': '{name} is poisoned.',
  'log.burned': '{name} catches fire.',
  'log.slowed': '{name} is slowed.',
  'log.statusTick': 'You take {damage} from lingering wounds.',
  'log.enemyEvaded': '{name} slips out of the way.',
  'log.guarded': '{name} raises its guard.',
  'log.revived': '{name} pulls itself back together!',
  'log.split': '{name} splits into {count}!',
  'log.enraged': '{name} is enraged!',
  'log.bossAppears': 'Something huge stirs on this floor.',
  'log.shieldBlocked': 'Your shield absorbs the blow.',
  'log.useScroll': 'You read the scroll.',
  'log.scrollBlast': 'A shockwave tears through {hits} enemies.',
  'log.scrollReveal': 'The floor plan burns into your mind.',
  'log.scrollTeleport': 'You are pulled to the stairs.',
  'log.scrollRage': 'Fury fills you for {turns} turns.',
  'log.scrollBanish': '{name} is banished.',
  'log.scrollCurse': 'A curse. Max HP -{amount}.',
  'log.needKey': 'It is locked. You need a Key.',
  'log.useKey': 'The key turns.',
  'log.eventDeclined': 'You walk away.',
  'log.shrineBlessed': 'Power for blood. ATK +20%, Max HP -10.',
  'log.merchantBought': 'You pay {price} gold.',
  'log.merchantPoor': 'Not enough gold.',
  'log.cursedReward': 'Treasure, and no trap. This time.',
  'log.cursedTrap': 'A trap! You take {damage}.',
  'log.springDrunk': 'You drink deep. (+{healed} HP, {count} drawn near)',
  'log.altarSwapped': '{from} is taken. {to} is left behind.',
  'log.altarEmpty': 'You have nothing to offer.',
  'log.hiddenRoom': 'A hidden room! {gold} gold. ({count} heard you)',
  'log.treasuryTaken': '{gold} gold. A guardian wakes. ({count})',
  'item.scroll': 'Scroll',
  'item.key': 'Key',
  'perk.poisonAttack': 'Poison Attack',
  'perk.fireDamage': 'Fire Damage',
  'perk.shield': 'Shield',
  'perkDesc.poisonAttack': '20% chance to poison on hit',
  'perkDesc.fireDamage': '15% chance to burn on hit',
  'perkDesc.shield': 'Negate one hit every 3 turns',
  'ui.status': 'STATUS',
  'status.poison': 'Poison',
  'status.burn': 'Burn',
  'status.slow': 'Slow',
  'status.rage': 'Rage',
  'status.guard': 'Guard',
  'event.shrine': 'MYSTERIOUS SHRINE',
  'event.merchant': 'MERCHANT',
  'event.cursedChest': 'CURSED CHEST',
  'event.healingSpring': 'HEALING SPRING',
  'event.strangeAltar': 'STRANGE ALTAR',
  'event.hiddenRoom': 'HIDDEN ROOM',
  'event.treasury': 'TREASURY',
  'eventLead.shrine': 'The stone asks for gold.',
  'eventLead.merchant': 'A trader waits in the dark.',
  'eventLead.cursedChest': 'The lid is warm to the touch.',
  'eventLead.healingSpring': 'Clear water, and something listening.',
  'eventLead.strangeAltar': 'Give one thing. Take another.',
  'eventLead.hiddenRoom': 'A draught behind the wall.',
  'eventLead.treasury': 'Gold beyond counting. And a shape beside it.',
  'opt.shrine0': 'Offer 50 gold',
  'opt.merchant0': 'Buy a Potion',
  'opt.merchant1': 'Buy equipment',
  'opt.cursedChest0': 'Open it',
  'opt.healingSpring0': 'Drink',
  'opt.strangeAltar0': 'Offer a piece of gear',
  'opt.hiddenRoom0': 'Break the wall',
  'opt.treasury0': 'Take the gold',
  'opt.leave': 'Walk away',
  'optDesc.shrine0': 'ATK +20%, Max HP -10',
  'optDesc.merchant0': '30 gold',
  'optDesc.merchant1': '80 gold, unknown item',
  'optDesc.cursedChest0': '70% rare gear, 30% trap for 25% of Max HP',
  'optDesc.healingSpring0': 'Heal to full, 2 more enemies on this floor',
  'optDesc.strangeAltar0': 'A random piece becomes another. Better or worse.',
  'optDesc.hiddenRoom0': 'Gold and an item. The noise draws one enemy.',
  'optDesc.treasury0': 'A pile of gold. A Warden wakes.',
  'optDesc.leave': 'Nothing gained, nothing risked',

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
  'item.elixir': 'Elixir',
  'itemDesc.heal': 'Restore {percent}% of Max HP',
  'itemDesc.bomb': 'Deal {damage} damage all around. Breaks walls.',
  'itemDesc.scroll': 'An unknown effect. Not always in your favour.',
  'itemDesc.key': 'Opens a locked chest.',
  'ui.stack': 'Held {count}/{max}',
  'ui.stackFull': 'Held {count}/{max} (full)',
  'ui.tapAgain': 'tap again to use',
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

  'log.achievement': 'ACHIEVEMENT: {name}',
  'ui.achievements': 'ACHIEVEMENTS',
  'ui.sound': 'Sound',
  'ui.locked': 'locked',
  'ui.unlocked': 'unlocked',
  'ach.firstBlood': 'First Blood',
  'ach.deepDiver': 'Deep Diver',
  'ach.treasureHunter': 'Treasure Hunter',
  'ach.slayer': 'Slayer',
  'ach.bossKiller': 'Boss Killer',
  'ach.centurion': 'Centurion',
  'ach.floor10': 'Floor 10',
  'ach.floor25': 'Floor 25',
  'ach.floor50': 'Floor 50',
  'achDesc.firstBlood': 'Kill your first enemy',
  'achDesc.deepDiver': 'Reach floor 5',
  'achDesc.treasureHunter': 'Open 10 chests in one run',
  'achDesc.slayer': 'Kill 30 enemies in one run',
  'achDesc.bossKiller': 'Kill a boss',
  'achDesc.centurion': 'Kill 100 enemies in total',
  'achDesc.floor10': 'Reach floor 10',
  'achDesc.floor25': 'Reach floor 25',
  'achDesc.floor50': 'Reach floor 50',
  'aria.soundOn': 'Turn sound on',
  'aria.soundOff': 'Turn sound off',
  'ui.tabGear': 'GEAR',
  'ui.tabLog': 'LOG',
};

const JA: Record<MessageKey, string> = {
  'log.welcome': '暗闇へと降りていく。探索し、戦い、さらに深く。',
  'log.floor': 'FLOOR {floor}',
  'log.playerHit': '{name} に {damage} のダメージを与えた。',
  'log.enemyHit': '{name} から {damage} のダメージを受けた。',
  'log.enemyDies': '{name} を倒した。+{exp} EXP',
  'log.levelUp': 'LEVEL UP! LV {level} になった。(+{healed} HP)',
  'log.died': '力尽きた。',
  'log.pickup': '{item} を {count} 個拾った。',
  'log.inventoryFull': '荷物がいっぱいだ。',
  'log.usePotion': 'Potion を飲んだ。(+{healed} HP)',
  'log.useElixir': 'Elixir を飲み干した。(+{healed} HP)',
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
  'log.poisoned': '{name} を毒に侵した。',
  'log.burned': '{name} が燃え上がった。',
  'log.slowed': '{name} の動きが鈍った。',
  'log.statusTick': '傷が広がる。{damage} のダメージ。',
  'log.enemyEvaded': '{name} にかわされた。',
  'log.guarded': '{name} が身構えた。',
  'log.revived': '{name} が起き上がった!',
  'log.split': '{name} が {count} 体に分裂した!',
  'log.enraged': '{name} が怒り狂った!',
  'log.bossAppears': 'この階に、何か大きなものがいる。',
  'log.shieldBlocked': '盾が攻撃を打ち消した。',
  'log.useScroll': '巻物を読んだ。',
  'log.scrollBlast': '衝撃波が敵 {hits} 体を貫いた。',
  'log.scrollReveal': 'この階の全容が頭に流れ込んだ。',
  'log.scrollTeleport': '階段へ引き寄せられた。',
  'log.scrollRage': '{turns} ターン、力がみなぎる。',
  'log.scrollBanish': '{name} が消え去った。',
  'log.scrollCurse': '呪いだ。最大HP -{amount}。',
  'log.needKey': '鍵がかかっている。Key が要る。',
  'log.useKey': '鍵が回った。',
  'log.eventDeclined': '立ち去った。',
  'log.shrineBlessed': '力と引き換えに血を。ATK +20%、最大HP -10。',
  'log.merchantBought': '{price} ゴールド支払った。',
  'log.merchantPoor': 'ゴールドが足りない。',
  'log.cursedReward': '宝だ。罠はなかった — 今回は。',
  'log.cursedTrap': '罠だ! {damage} のダメージ。',
  'log.springDrunk': '水を飲み干した。(+{healed} HP、{count} 体が寄ってきた)',
  'log.altarSwapped': '{from} を捧げ、{to} が残された。',
  'log.altarEmpty': '捧げる物がない。',
  'log.hiddenRoom': '隠し部屋だ! {gold} ゴールド。({count} 体が音を聞きつけた)',
  'log.treasuryTaken': '{gold} ゴールド。番人が目を覚ました。({count})',
  'item.scroll': 'Scroll',
  'item.key': 'Key',
  'perk.poisonAttack': 'Poison Attack',
  'perk.fireDamage': 'Fire Damage',
  'perk.shield': 'Shield',
  'perkDesc.poisonAttack': '攻撃時 20% で毒',
  'perkDesc.fireDamage': '攻撃時 15% で火傷',
  'perkDesc.shield': '3ターンに1回、被弾を無効化',
  'ui.status': 'STATUS',
  'status.poison': '毒',
  'status.burn': '火傷',
  'status.slow': '鈍足',
  'status.rage': '激昂',
  'status.guard': '防御',
  'event.shrine': '謎の祭壇',
  'event.merchant': '商人',
  'event.cursedChest': '呪われた宝箱',
  'event.healingSpring': '回復の泉',
  'event.strangeAltar': '奇妙な供物台',
  'event.hiddenRoom': '隠し部屋',
  'event.treasury': '宝物庫',
  'eventLead.shrine': '石がゴールドを求めている。',
  'eventLead.merchant': '暗がりに商人が待っている。',
  'eventLead.cursedChest': '蓋がぬるい。',
  'eventLead.healingSpring': '澄んだ水。何かが聞き耳を立てている。',
  'eventLead.strangeAltar': '一つ捧げ、一つ受け取る。',
  'eventLead.hiddenRoom': '壁の向こうから風が来る。',
  'eventLead.treasury': '数えきれない金。その脇に、影。',
  'opt.shrine0': '50 ゴールドを捧げる',
  'opt.merchant0': 'Potion を買う',
  'opt.merchant1': '装備を買う',
  'opt.cursedChest0': '開ける',
  'opt.healingSpring0': '飲む',
  'opt.strangeAltar0': '装備を1つ捧げる',
  'opt.hiddenRoom0': '壁を壊す',
  'opt.treasury0': '金を取る',
  'opt.leave': '立ち去る',
  'optDesc.shrine0': 'ATK +20%、最大HP -10',
  'optDesc.merchant0': '30 ゴールド',
  'optDesc.merchant1': '80 ゴールド、中身は不明',
  'optDesc.cursedChest0': '70% でレア装備、30% で最大HPの25%のダメージ',
  'optDesc.healingSpring0': '全回復。ただしこの階の敵が2体増える',
  'optDesc.strangeAltar0': '装備1つがランダムに入れ替わる。良くなるとは限らない',
  'optDesc.hiddenRoom0': 'ゴールドとアイテム。物音で敵が1体寄ってくる',
  'optDesc.treasury0': '大量のゴールド。Warden が目を覚ます',
  'optDesc.leave': '何も得ず、何も賭けない',

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
  'item.elixir': 'Elixir',
  'itemDesc.heal': 'HP を最大値の {percent}% 回復',
  'itemDesc.bomb': '周囲8マスに {damage} ダメージ。壁も壊す',
  'itemDesc.scroll': '未知の効果。当たりとは限らない',
  'itemDesc.key': '施錠された宝箱を開ける',
  'ui.stack': '所持 {count}/{max}',
  'ui.stackFull': '所持 {count}/{max}（上限）',
  'ui.tapAgain': 'もう一度タップで使用',
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

  'log.achievement': '実績解除: {name}',
  'ui.achievements': 'ACHIEVEMENTS',
  'ui.sound': '効果音',
  'ui.locked': '未解除',
  'ui.unlocked': '解除済み',
  'ach.firstBlood': 'First Blood',
  'ach.deepDiver': 'Deep Diver',
  'ach.treasureHunter': 'Treasure Hunter',
  'ach.slayer': 'Slayer',
  'ach.bossKiller': 'Boss Killer',
  'ach.centurion': 'Centurion',
  'ach.floor10': 'Floor 10',
  'ach.floor25': 'Floor 25',
  'ach.floor50': 'Floor 50',
  'achDesc.firstBlood': '初めて敵を倒す',
  'achDesc.deepDiver': '5階に到達する',
  'achDesc.treasureHunter': '1回の探索で宝箱を10個開ける',
  'achDesc.slayer': '1回の探索で敵を30体倒す',
  'achDesc.bossKiller': 'ボスを倒す',
  'achDesc.centurion': '累計100体倒す',
  'achDesc.floor10': '10階に到達する',
  'achDesc.floor25': '25階に到達する',
  'achDesc.floor50': '50階に到達する',
  'aria.soundOn': '効果音を鳴らす',
  'aria.soundOff': '効果音を止める',
  'ui.tabGear': '装備',
  'ui.tabLog': 'ログ',
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
