import type {
  AchievementId,
  ItemId,
  EventId,
  GameState,
  PendingChoice,
  PerkId,
  Slot,
  StatMods,
} from '../core/types';
import { ACHIEVEMENT_IDS } from '../data/achievements';
import type { PanelTab, Settings } from '../storage/settings';
import type { RunOutcome, SaveData } from '../storage/save';
import { computeScore } from '../storage/save';
import { renderBoard } from './board';
import { renderHud, renderSettings } from './hud';
import type { MessageKey } from './i18n';
import { t } from './i18n';
import { formatLogEntry } from './logline';
import { itemSpriteId } from './sprites';
import { BOMB_DAMAGE, ELIXIR_HEAL, MAX_STACK, POTION_HEAL } from '../core/constants';

export interface ViewContext {
  settings: Settings;
  save: SaveData;
  /**
   * タッチで選択中のスロット番号。
   *
   * ホバーできない環境では 1 回目のタップで説明を出し、2 回目で使う。
   * その「選択中」を表す値で、保存はしない（次の操作で消える一時的な状態）。
   */
  selectedSlot: number | null;
  /**
   * 直前の Run の結果。死亡時に recordRun が返したものをそのまま渡す。
   *
   * ここで再計算してはいけない。recordRun は save を更新済みなので、
   * 更新後の bestScore と比べると「同点」と「更新」を区別できなくなる。
   */
  lastRun: RunOutcome | null;
}

/** ルート描画。状態を読んで画面を組み立てるだけで、状態を書き換えない。 */
export function render(root: HTMLElement, state: GameState, ctx: ViewContext): void {
  const { settings } = ctx;
  root.innerHTML = `
    ${renderHud(state, settings)}
    <main class="stage${stageEffects(state)}">
      <div class="stage__board">${renderBoard(state, settings)}${renderFx(state)}</div>
      <aside class="stage__side" data-tab="${settings.panel}">
        ${renderTabs(settings)}
        <div class="side__group side__group--gear">
          ${renderStatus(state, settings)}
          ${renderEquipment(state, settings)}
          ${renderItems(state, settings, ctx.selectedSlot)}
          ${renderPerks(state, settings)}
        </div>
        <div class="side__group side__group--log">
          ${renderLog(state, settings)}
        </div>
        <div class="side__group side__group--dpad">
          ${renderDpad(settings)}
        </div>
      </aside>
    </main>
    <footer class="hint">
      <span class="hint__keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd> ${t(settings.lang, 'ui.move')}</span>
      <span class="hint__keys"><kbd>1</kbd>-<kbd>8</kbd> ${t(settings.lang, 'ui.useItemHint')} / <kbd>Shift</kbd>+<kbd>1</kbd>-<kbd>8</kbd> ${t(settings.lang, 'ui.drop')}</span>
      <span class="hint__tap">${t(settings.lang, 'ui.tapMove')}</span>
      <span class="hint__motto">${t(settings.lang, 'ui.motto')}</span>
    </footer>
    ${renderSettings(settings)}
    ${state.phase === 'choosing' ? renderChoiceModal(state, settings) : ''}
    ${state.phase === 'dead' ? renderDeathModal(state, ctx) : ''}
  `;

  // innerHTML で挿入した要素の autofocus は効かないため明示的に当てる。
  // キーボードだけで「死ぬ -> すぐ次の Run」まで回せることを保証する。
  if (state.phase === 'dead') {
    root.querySelector<HTMLButtonElement>('[data-action="restart"]')?.focus();
  } else if (state.phase === 'choosing') {
    root.querySelector<HTMLButtonElement>('[data-choose]')?.focus();
  }
}

/**
 * 演出クラス。ゲーム状態から導出する — UI 側にフラグを持たない。
 *
 * `render()` は毎ターン innerHTML を作り直すので、クラスを付けるだけで
 * CSS アニメーションが必ず先頭から再生される。状態を持つ必要がない。
 */
function stageEffects(state: GameState): string {
  const marks: string[] = [];
  const player = state.player;
  // 被弾と呪いは同じ赤いフラッシュで伝える。プレイヤーにとっては
  // どちらも「悪いことが起きた」で、区別する必要がない。
  if (player.hurtOnTurn === state.turn || player.cursedOnTurn === state.turn) {
    marks.push('stage--hurt');
  }
  if (player.leveledOnTurn === state.turn) marks.push('stage--levelup');
  return marks.length > 0 ? ' ' + marks.join(' ') : '';
}

/**
 * 盤面全体の演出。
 *
 * 今のターンに起きた出来事だけを描く。`render()` は毎ターン innerHTML を
 * 作り直すので、要素が現れた時点で CSS アニメーションが先頭から再生される。
 */
function renderFx(state: GameState): string {
  const event = state.stageEvent;
  if (!event || event.turn !== state.turn) return '';
  return `<div class="fx fx--${event.kind}" aria-hidden="true"></div>`;
}

/**
 * 狭い画面ではサイドパネルの中身が縦に伸びすぎるので、装備・ログ・方向キーを
 * 切り替える。3つが同じ高さを奪い合う形にすることで、iPhone の縦画面でも
 * スクロールせずに全部へ手が届く。
 *
 * 選択は設定として保存する — 一度選んだ見た目が次に開いた時も残る。
 */
function renderTabs(settings: Settings): string {
  const tab = (id: PanelTab, label: string) =>
    `<button class="tab tab--${id}${settings.panel === id ? ' tab--active' : ''}"` +
    ` data-set-panel="${id}" aria-pressed="${settings.panel === id}">${label}</button>`;

  return (
    `<nav class="tabs">` +
    tab('gear', t(settings.lang, 'ui.tabGear')) +
    tab('log', t(settings.lang, 'ui.tabLog')) +
    tab('dpad', t(settings.lang, 'ui.tabDpad')) +
    `</nav>`
  );
}

/**
 * 実績。未解除も名前と条件を見せる — 何を目指せるのかが分かって初めて目標になる。
 */
function renderAchievements(unlocked: readonly AchievementId[], settings: Settings): string {
  const have = new Set(unlocked);
  const rows = ACHIEVEMENT_IDS.map((id) => {
    const done = have.has(id);
    return (
      `<li class="ach${done ? ' ach--done' : ''}">` +
      `<span class="ach__name">${escapeHtml(t(settings.lang, `ach.${id}` as const))}</span>` +
      `<span class="ach__desc">${escapeHtml(t(settings.lang, `achDesc.${id}` as const))}</span>` +
      `</li>`
    );
  }).join('');

  return (
    `<section class="panel"><h2 class="panel__title">` +
    `${t(settings.lang, 'ui.achievements')} ${have.size}/${ACHIEVEMENT_IDS.length}` +
    `</h2><ul class="ach__list">${rows}</ul></section>`
  );
}

// --- パネル ------------------------------------------------------------------

/**
 * 継続効果。何に削られているのかを画面から読めるようにする。
 * 効果が1つもないときはパネルごと出さない — 常時空欄が居座ると視線の邪魔になる。
 */
function renderStatus(state: GameState, settings: Settings): string {
  const effects = state.player.effects.filter((e) => e.turns > 0);
  if (effects.length === 0) return '';

  const tags = effects
    .map((effect) => {
      const name = escapeHtml(t(settings.lang, `status.${effect.kind}` as const));
      return `<li class="status status--${effect.kind}">${name}<span class="status__turns">${effect.turns}</span></li>`;
    })
    .join('');
  return `<section class="panel panel--status"><h2 class="panel__title">${t(settings.lang, 'ui.status')}</h2><ul class="status__list">${tags}</ul></section>`;
}

const SLOTS: readonly Slot[] = ['weapon', 'armor', 'ring'];

function renderEquipment(state: GameState, settings: Settings): string {
  const rows = SLOTS.map((slot) => {
    const item = state.player.equipment[slot];
    const name = item ? item.name : t(settings.lang, 'ui.empty');
    const modifier = item ? ` gear__name--${item.rarity}` : ' gear__name--empty';
    // 装備にも同じ仕組みで補正を出す。名前だけでは何が強いのか分からない。
    const tip = item
      ? `<span class="tip" role="tooltip">` +
        `<span class="tip__name">${escapeHtml(item.name)}</span>` +
        `<span class="tip__desc">${formatMods(item.mods)}</span>` +
        `</span>`
      : '';

    return (
      `<li class="gear${item ? ' gear--filled' : ''}">` +
      `<svg class="gear__icon" viewBox="0 0 1 1" shape-rendering="crispEdges" aria-hidden="true">` +
      `<use href="#sp-${slot}-0" width="1" height="1"/></svg>` +
      `<span class="gear__slot">${t(settings.lang, `slot.${slot}` as const)}</span>` +
      `<span class="gear__name${modifier}">${escapeHtml(name)}</span>` +
      `${tip}</li>`
    );
  }).join('');
  return `<section class="panel panel--equipment"><h2 class="panel__title">${t(settings.lang, 'ui.equipment')}</h2><ul class="gear__list">${rows}</ul></section>`;
}

/**
 * インベントリ。数字キーとクリックの両方で使える。
 * 空きスロットも描くことで「何個持てるか」を常に見せる。
 */
/**
 * アイテムの効果を1行で説明する。
 *
 * 数値は定数から組み立てる。文言に直接書くと、バランス調整のたびに
 * 説明と実際の効果がずれていく。
 */
function itemTip(settings: Settings, itemId: ItemId): string {
  const lang = settings.lang;
  switch (itemId) {
    case 'potion':
      return t(lang, 'itemDesc.heal', { percent: Math.round(POTION_HEAL * 100) });
    case 'elixir':
      return t(lang, 'itemDesc.heal', { percent: Math.round(ELIXIR_HEAL * 100) });
    case 'bomb':
      return t(lang, 'itemDesc.bomb', { damage: BOMB_DAMAGE });
    case 'scroll':
      return t(lang, 'itemDesc.scroll');
    case 'key':
      return t(lang, 'itemDesc.key');
  }
}

function renderItems(state: GameState, settings: Settings, selectedSlot: number | null): string {
  const slots = state.player.inventory
    .map((stack, index) => {
      const key = index + 1;
      if (!stack) {
        return `<li class="slot slot--empty"><span class="slot__key">${key}</span></li>`;
      }
      const name = t(settings.lang, `item.${stack.itemId}` as const);
      const label = t(settings.lang, 'aria.useItem', {
        item: name,
        slot: key,
        count: stack.count,
      });
      const selected = selectedSlot === index;
      // 説明はマウスならホバー、タッチなら1回目のタップで出す。
      // どちらも CSS で解決するので、UI 側に表示状態を持たない。
      // 1スロットの上限を見せる。見えないと「同じ物なのに2枠に分かれた」ように見える。
      const full = stack.count >= MAX_STACK;
      const held = t(settings.lang, full ? 'ui.stackFull' : 'ui.stack', {
        count: stack.count,
        max: MAX_STACK,
      });
      const tip =
        `<span class="tip" role="tooltip">` +
        `<span class="tip__name">${escapeHtml(name)}</span>` +
        `<span class="tip__desc">${escapeHtml(itemTip(settings, stack.itemId))}</span>` +
        `<span class="tip__held${full ? ' tip__held--full' : ''}">${escapeHtml(held)}</span>` +
        (selected ? `<span class="tip__hint">${escapeHtml(t(settings.lang, 'ui.tapAgain'))}</span>` : '') +
        `</span>`;

      return (
        `<li class="slot${selected ? ' slot--selected' : ''}">` +
        `<button class="slot__btn" data-use-slot="${index}" aria-label="${escapeHtml(label)}">` +
        `<span class="slot__key">${key}</span>` +
        `<svg class="slot__icon" viewBox="0 0 1 1" shape-rendering="crispEdges" aria-hidden="true">` +
        `<use href="#${itemSpriteId(stack.itemId)}" width="1" height="1"/></svg>` +
        `<span class="slot__count${full ? ' slot__count--full' : ''}">${stack.count}</span>` +
        `</button>` +
        // 捨てるボタン。ホバー・フォーカス・タッチ選択のときだけ出す。
        // 常時出すとアイコンを覆って、何のアイテムか分からなくなる。
        `<button class="slot__drop" data-drop-slot="${index}"` +
        ` aria-label="${escapeHtml(t(settings.lang, 'aria.dropItem', { item: name }))}"` +
        ` title="${escapeHtml(t(settings.lang, 'ui.drop'))}">&times;</button>` +
        `${tip}</li>`
      );
    })
    .join('');
  return `<section class="panel panel--items"><h2 class="panel__title">${t(settings.lang, 'ui.items')}</h2><ul class="items__list">${slots}</ul></section>`;
}

/** 取得済みのパーク。同じものを重ねて取れるので個数をまとめて出す。 */
function renderPerks(state: GameState, settings: Settings): string {
  if (state.player.perks.length === 0) return '';

  const counts = new Map<PerkId, number>();
  for (const perk of state.player.perks) counts.set(perk, (counts.get(perk) ?? 0) + 1);

  const tags = [...counts.entries()]
    .map(([perk, count]) => {
      const name = escapeHtml(t(settings.lang, `perk.${perk}` as const));
      const badge = count > 1 ? `<span class="perk__count">&times;${count}</span>` : '';
      return `<li class="perk">${name}${badge}</li>`;
    })
    .join('');
  return `<section class="panel panel--perks"><h2 class="panel__title">${t(settings.lang, 'ui.perks')}</h2><ul class="perk__list">${tags}</ul></section>`;
}

function renderLog(state: GameState, settings: Settings): string {
  // 末尾が最新。新しいものを上に出すと視線が飛ぶので、下から積み上げる。
  const items = state.log
    .slice(-10)
    .map(
      (entry) =>
        `<li class="log__line log__line--${entry.tone}">${escapeHtml(
          formatLogEntry(settings.lang, entry),
        )}</li>`,
    )
    .join('');
  return `<section class="panel log"><h2 class="panel__title">${t(settings.lang, 'ui.log')}</h2><ul class="log__list">${items}</ul></section>`;
}

/**
 * 方向パッド。表示可否は settings.dpad と CSS のメディアクエリで決まる（→ main.css）。
 * 'auto' のときだけ画面サイズとポインタ種別で自動判定する。
 *
 * 中央に待機ボタンは置かない。十字の真ん中に「動かない」を置いても意味が読めず、
 * 誤爆の的にしかならなかった（Issue #2）。待機は自分のマスをタップする方に寄せた。
 */
function renderDpad(settings: Settings): string {
  const lang = settings.lang;
  const btn = (dir: string, label: string, glyph: string) =>
    `<button class="dpad__btn dpad__btn--${dir}" data-dir="${dir}" aria-label="${label}">${glyph}</button>`;

  return `
    <nav class="dpad" aria-label="${t(lang, 'ui.move')}">
      ${btn('up', t(lang, 'aria.moveUp'), '&uarr;')}
      ${btn('left', t(lang, 'aria.moveLeft'), '&larr;')}
      ${btn('right', t(lang, 'aria.moveRight'), '&rarr;')}
      ${btn('down', t(lang, 'aria.moveDown'), '&darr;')}
    </nav>
  `;
}

// --- モーダル ----------------------------------------------------------------

function renderChoiceModal(state: GameState, settings: Settings): string {
  const choice = state.pendingChoices[0];
  if (!choice) return '';
  if (choice.kind === 'levelup') return renderLevelUpModal(choice, settings);
  if (choice.kind === 'event') return renderEventModal(choice, settings);
  return renderGearModal(choice, settings);
}

/**
 * イベントごとの選択肢のメッセージキー。
 *
 * `opt.${id}${i}` のようにテンプレートで組み立てると型で守れなくなる。
 * 明示的に並べておけば、イベントを増やしたときに書き忘れがコンパイルで止まる。
 */
const EVENT_OPTIONS: Record<EventId, readonly (readonly [MessageKey, MessageKey])[]> = {
  shrine: [['opt.shrine0', 'optDesc.shrine0']],
  merchant: [
    ['opt.merchant0', 'optDesc.merchant0'],
    ['opt.merchant1', 'optDesc.merchant1'],
  ],
  cursedChest: [['opt.cursedChest0', 'optDesc.cursedChest0']],
  healingSpring: [['opt.healingSpring0', 'optDesc.healingSpring0']],
  strangeAltar: [['opt.strangeAltar0', 'optDesc.strangeAltar0']],
  hiddenRoom: [['opt.hiddenRoom0', 'optDesc.hiddenRoom0']],
  treasury: [['opt.treasury0', 'optDesc.treasury0']],
};

/**
 * ランダムイベント。最後の選択肢は常に「立ち去る」。
 * 何も賭けずに済ませる道を必ず残しておかないと、イベントは判断ではなく強制になる。
 */
function renderEventModal(
  choice: Extract<PendingChoice, { kind: 'event' }>,
  settings: Settings,
): string {
  const lang = settings.lang;
  const id = choice.eventId;
  const options: string[] = (EVENT_OPTIONS[id] ?? []).map(([label, desc], i) =>
    choiceButton(i, escapeHtml(t(lang, label)), escapeHtml(t(lang, desc))),
  );
  options.push(
    choiceButton(
      choice.optionCount - 1,
      escapeHtml(t(lang, 'opt.leave')),
      escapeHtml(t(lang, 'optDesc.leave')),
    ),
  );

  return modal(
    'event',
    t(lang, `event.${id}` as const),
    t(lang, `eventLead.${id}` as const),
    options.join(''),
  );
}

function renderLevelUpModal(
  choice: Extract<PendingChoice, { kind: 'levelup' }>,
  settings: Settings,
): string {
  const lang = settings.lang;
  const options = choice.options
    .map((perk, index) =>
      choiceButton(
        index,
        escapeHtml(t(lang, `perk.${perk}` as const)),
        escapeHtml(t(lang, `perkDesc.${perk}` as const)),
      ),
    )
    .join('');

  return modal('levelup', t(lang, 'ui.levelUp'), t(lang, 'ui.choosePerk', { level: choice.level }), options);
}

/**
 * 装備の持ち替え。どちらが上位とも言えない組み合わせのときだけ開く。
 * 両方の補正を並べて出し、数字を見比べて決められるようにする。
 */
function renderGearModal(
  choice: Extract<PendingChoice, { kind: 'equipment' }>,
  settings: Settings,
): string {
  const lang = settings.lang;
  const options =
    choiceButton(
      0,
      escapeHtml(t(lang, 'ui.takeNew', { name: choice.candidate.name })),
      formatMods(choice.candidate.mods),
    ) +
    choiceButton(
      1,
      escapeHtml(t(lang, 'ui.keepCurrent', { name: choice.current.name })),
      `${formatMods(choice.current.mods)} <span class="choice__tag">${t(lang, 'ui.current')}</span>`,
    );

  return modal('gear', t(lang, 'ui.swapGear'), t(lang, 'ui.chooseGear'), options);
}

function modal(id: string, title: string, lead: string, options: string): string {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
      <div class="modal__panel modal__panel--wide">
        <h2 class="modal__title modal__title--good" id="${id}-title">${title}</h2>
        <p class="modal__lead">${lead}</p>
        <div class="choices">${options}</div>
      </div>
    </div>
  `;
}

function choiceButton(index: number, name: string, desc: string): string {
  return (
    `<button class="choice" data-choose="${index}">` +
    `<span class="choice__key">${index + 1}</span>` +
    `<span class="choice__name">${name}</span>` +
    `<span class="choice__desc">${desc}</span>` +
    `</button>`
  );
}

/**
 * ステータス補正を短い英字表記に組み立てる。
 * HUD の見出しと同じく英語のままにして、i18n のキーを10個増やさない。
 */
function formatMods(mods: StatMods): string {
  const parts: string[] = [];
  const flat = (value: number | undefined, label: string): void => {
    if (value) parts.push(`${value > 0 ? '+' : ''}${value} ${label}`);
  };
  const pct = (value: number | undefined, label: string): void => {
    if (value) parts.push(`${value > 0 ? '+' : ''}${Math.round(value * 100)}% ${label}`);
  };

  flat(mods.attack, 'ATK');
  pct(mods.attackPct, 'ATK');
  flat(mods.defense, 'DEF');
  flat(mods.maxHp, 'Max HP');
  pct(mods.crit, 'CRIT');
  pct(mods.evasion, 'EVA');
  pct(mods.lifesteal, 'Lifesteal');
  flat(mods.thorns, 'Thorns');
  pct(mods.goldPct, 'GOLD');
  pct(mods.expPct, 'EXP');

  return escapeHtml(parts.join('  '));
}

function renderDeathModal(state: GameState, ctx: ViewContext): string {
  const { settings, save, lastRun } = ctx;
  const elapsed = Math.max(0, Date.now() - state.stats.startedAt);
  const score = lastRun?.score ?? computeScore(state);
  const bestScore = Math.max(save.bestScore, score);
  const bestDepth = Math.max(save.bestDepth, state.stats.deepestFloor);
  // 記録の更新かどうかは recordRun の判定をそのまま使う（同点は更新ではない）
  const isBest = lastRun?.newBestScore ?? false;

  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="death-title">
      <div class="modal__panel">
        <h2 class="modal__title" id="death-title">YOU DIED</h2>
        <dl class="result">
          ${resultRow('DEPTH', `FLOOR ${state.stats.deepestFloor}`)}
          ${resultRow('KILLS', String(state.stats.kills))}
          ${resultRow('GOLD', String(state.stats.goldEarned))}
          ${resultRow('LEVEL', String(state.player.level))}
          ${resultRow('TIME', formatDuration(elapsed))}
          ${resultRow(
            t(settings.lang, 'ui.score'),
            String(score),
            isBest ? t(settings.lang, 'ui.newBest') : '',
          )}
        </dl>
        <p class="result__best">${t(settings.lang, 'ui.best')} &middot; FLOOR ${bestDepth} &middot; ${bestScore}</p>
        ${renderAchievements(save.achievements, settings)}
        <button class="btn btn--primary" data-action="restart">DELVE AGAIN</button>
        <p class="modal__hint">${t(settings.lang, 'ui.pressEnter', { key: 'Enter' })}</p>
      </div>
    </div>
  `;
}

/** リザルトの見出しは HUD と揃えて英語のまま（→ i18n.ts の方針）。 */
function resultRow(label: string, value: string, badge = ''): string {
  const mark = badge ? `<span class="result__badge">${escapeHtml(badge)}</span>` : '';
  return `<div class="result__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}${mark}</dd></div>`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
