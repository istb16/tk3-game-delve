import './styles/main.css';

import type { GameState, Intent, LogEntry } from './core/types';
import { createGame } from './game/state';
import { takeTurn } from './game/turn';
import { tileIndex } from './game/dungeon';
import { render } from './ui/view';
import {
  boardCellFromPoint,
  intentFromBoardTap,
  intentFromDpad,
  intentFromKey,
  isGameKey,
  isHoverless,
  resolveSlotTap,
} from './ui/input';
import { installFavicon } from './ui/favicon';
import { installSplash } from './ui/splash';
import type { DpadMode, Lang, PanelTab, Settings } from './storage/settings';
import { loadSettings, saveSettings } from './storage/settings';
import type { RunOutcome, SaveData } from './storage/save';
import { loadSave, recordAchievements, recordRun } from './storage/save';
import { addLog } from './core/log';
import { evaluateAchievements, logAchievements } from './game/achievements';
import { setSoundEnabled } from './audio/sfx';
import { playCues } from './ui/cues';
import { isLogVisible, showToasts } from './ui/toast';

const container = document.getElementById('app');
if (!container) throw new Error('#app not found');
// 明示的に型を確定させる。以降のクロージャで null チェックを繰り返さないため。
const root: HTMLElement = container;

installFavicon();

let settings: Settings = loadSettings();
applySettings();

let save: SaveData = loadSave();
/** 直前の Run の結果。リザルト画面が「記録を更新したか」を判定するのに使う。 */
let lastRun: RunOutcome | null = null;
/**
 * タッチで選択中のスロット。ホバーできない環境で「1回目のタップで説明、
 * 2回目で使用」を成り立たせるための一時的な状態。保存はしない。
 */
let selectedSlot: number | null = null;
let state: GameState = createGame();
draw();
// 盤面を描いた直後に被せる。同じ同期スクリプト内なので、最初のペイントの時点で
// 既に上に載っている（盤面が一瞬見えることはない）。
installSplash(settings.lang);

function draw(): void {
  render(root, state, { settings, save, lastRun, selectedSlot });
}

/**
 * 設定を DOM に反映する。
 *
 * 方向パッドの表示可否は CSS のメディアクエリで解決させるため、
 * ここでは `data-dpad` を置くだけにする。JS で画面幅を監視すると、
 * リサイズや端末回転のたびに再描画が必要になり、CSS の得意分野を奪ってしまう。
 */
function applySettings(): void {
  document.documentElement.dataset['dpad'] = settings.dpad;
  document.documentElement.lang = settings.lang;
  setSoundEnabled(settings.sound);
}

function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  applySettings();
  draw();
}

/**
 * キーの押しっぱなしによる連続移動を、危険を検出した時点で止めるためのフラグ。
 * 「押しっぱなしにしていたら気づかないうちに死んでいた」を防ぐ。
 * 古典的ローグライクの走行中断ルールと同じ考え方（docs/05 §5.11）。
 */
let repeatBlocked = false;

/** 視界内に見えている敵の id 集合。新しい敵の出現を検出するために使う。 */
function visibleEnemyIds(current: GameState): Set<string> {
  const ids = new Set<string>();
  for (const enemy of current.enemies) {
    if (current.dungeon.visible[tileIndex(current.dungeon, enemy.pos.x, enemy.pos.y)]) {
      ids.add(enemy.id);
    }
  }
  return ids;
}

/**
 * Intent を1つ処理して再描画する。
 * ゲームは入力駆動なので、ここが唯一の状態進行の入口になる。
 */
function dispatch(intent: Intent): void {
  /** このターンに積まれたログ。描画後にトーストへ回す。 */
  let fresh: readonly LogEntry[] = [];

  // Intent が来た = 盤面を動かす操作なので、タッチの選択は必ず解除する。
  // 「1回目のタップで選択するだけ」はここに来ない（draw() で描き直すだけ）。
  //
  // 種類ごとに残す形にすると、自分で解除してから dispatch するクリック経路と
  // 解除しないキーボード経路（Shift+数字で捨てる）で挙動が食い違い、
  // 捨てた直後の1タップが説明なしの使用になる。
  selectedSlot = null;

  if (intent.type === 'restart') {
    // 死亡中のみ再開を受け付ける。プレイ中の誤爆で Run が消えるのを防ぐ。
    if (state.phase !== 'dead') return;
    state = createGame();
    lastRun = null;
    repeatBlocked = false;
  } else {
    const wasAlive = state.phase !== 'dead';
    const hpBefore = state.player.hp;
    const floorBefore = state.floor;
    const seenBefore = visibleEnemyIds(state);

    // 新しいログは id の差分で取る。配列の長さで区切ると、上限に達して
    // 先頭から切り捨てられた時点で境界が意味を失い、以降ずっと「新規なし」になる。
    const lastLogId = state.log[state.log.length - 1]?.id ?? -1;
    takeTurn(state, intent);

    // 実績は毎ターン見る。述語が9個なので負荷は無視できる。
    // 「100体目で解除」を死亡まで待たせないために、進行中に判定する。
    const unlocked = evaluateAchievements(state, save.achievements, save.totalKills);
    if (unlocked.length > 0) {
      logAchievements(state, unlocked);
      save = recordAchievements(save, unlocked);
    }

    const tookDamage = state.player.hp < hpBefore;
    const changedFloor = state.floor !== floorBefore;
    const newEnemyAppeared = [...visibleEnemyIds(state)].some((id) => !seenBefore.has(id));
    if (tookDamage || changedFloor || newEnemyAppeared) repeatBlocked = true;

    // 記録の書き込みは死亡時の1回だけ。localStorage は同期処理なので、
    // 毎ターン書くと入力の応答が鈍る。
    if (wasAlive && state.phase === 'dead') {
      const outcome = recordRun(save, state);
      save = outcome.save;
      lastRun = outcome;
      if (outcome.newBestDepth) {
        addLog(state.log, 'log.newBest', { floor: state.stats.deepestFloor }, 'system');
      }
    }
    // 音は「何が起きたか」をログから引く。game/ は音の存在を知らない。
    fresh = state.log.filter((entry) => entry.id > lastLogId);
    playCues(fresh.map((entry) => entry.key));
  }
  draw();

  // ログのパネルが隠れているときだけ、新しい行を右上に流す。
  // 判定は描画の**後**に行う。設定を変えた直後は、描き直すまで
  // DOM が古いタブのままで、見えている・いないを取り違える。
  if (fresh.length > 0 && !isLogVisible(root)) showToasts(fresh, settings.lang, root);
}

window.addEventListener('keydown', (event) => {
  const intent = intentFromKey(event, state.phase);
  if (!intent) {
    // モーダル表示中は意味を持たないゲームのキーも飲み込む。
    // 素通りさせると、選択中に矢印やスペースで背後のページがスクロールしてしまう。
    if (state.phase !== 'playing' && isGameKey(event)) event.preventDefault();
    return;
  }
  event.preventDefault();

  // リピートを受け付けるのは移動と待機だけ。
  // アイテム使用やリスタートは「1回押したら1回」でなければ、
  // キーが張り付いただけで在庫を全部飲み干してしまう。
  const repeatable = intent.type === 'move' || intent.type === 'wait';
  if (event.repeat) {
    if (!repeatable || repeatBlocked) return;
  } else {
    // 押し直しは常に受け付ける。中断は「押しっぱなし」にだけ掛かる。
    repeatBlocked = false;
  }

  dispatch(intent);
});

window.addEventListener('keyup', () => {
  repeatBlocked = false;
});

// 方向パッドと DELVE AGAIN。render() で DOM を作り直すため、
// 個別要素ではなく root への委譲でハンドラを1つに保つ。
root.addEventListener('click', (event) => {
  // HTMLElement ではなく Element で受ける。
  // ボタンの中身がインライン SVG（アイテムのアイコン）の場合、クリック先は
  // SVGElement になり、HTMLElement で絞ると**アイコンを押しても反応しない**。
  // ボタン自体は HTML なので、closest で辿った先で改めて絞る。
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest(
    '[data-dir], [data-action], [data-set-lang], [data-set-dpad], [data-set-sound],' +
      ' [data-set-panel], [data-use-slot], [data-drop-slot], [data-choose],' +
      ' [data-toggle-settings]',
  );
  if (!(button instanceof HTMLElement)) return;

  const lang = button.dataset['setLang'];
  if (lang === 'en' || lang === 'ja') {
    updateSettings({ lang: lang as Lang });
    return;
  }

  const dpad = button.dataset['setDpad'];
  if (dpad === 'auto' || dpad === 'on' || dpad === 'off') {
    // 方向キーを消したのにタブだけ残ると、サイドパネルが空になる。
    // 表示できないタブを選んだままにしない。
    const panel: PanelTab = dpad === 'off' && settings.panel === 'dpad' ? 'gear' : settings.panel;
    updateSettings({ dpad: dpad as DpadMode, panel });
    return;
  }

  if (button.dataset['toggleSettings'] !== undefined) {
    updateSettings({ settingsOpen: !settings.settingsOpen });
    return;
  }

  const sound = button.dataset['setSound'];
  if (sound === 'on' || sound === 'off') {
    // 有効化はクリックの中で行う。ここで AudioContext を作れば suspended にならない。
    updateSettings({ sound: sound === 'on' });
    return;
  }

  const panel = button.dataset['setPanel'];
  if (panel === 'gear' || panel === 'log' || panel === 'dpad') {
    updateSettings({ panel: panel as PanelTab });
    return;
  }

  const choose = button.dataset['choose'];
  if (choose !== undefined) {
    dispatch({ type: 'choose', index: Number(choose) });
    return;
  }

  const dropSlot = button.dataset['dropSlot'];
  if (dropSlot !== undefined) {
    dispatch({ type: 'dropItem', slot: Number(dropSlot) });
    return;
  }

  const slot = button.dataset['useSlot'];
  if (slot !== undefined) {
    // ホバーできない環境では、1回目のタップで説明を出して選択するだけにする。
    // 即使用にすると、何のアイテムか確かめる手段が「使ってみる」しかなくなる。
    const action = resolveSlotTap(Number(slot), selectedSlot, isHoverless());
    if (action.type === 'select') {
      selectedSlot = action.slot;
      draw();
      return;
    }
    dispatch({ type: 'useItem', slot: action.slot });
    return;
  }

  if (button.dataset['action'] === 'restart') {
    dispatch({ type: 'restart' });
    return;
  }

  const dir = button.dataset['dir'];
  if (!dir) return;
  const intent = intentFromDpad(dir);
  if (intent) dispatch(intent);
});

/**
 * 盤面のタップで歩く。
 *
 * ボタンを増やさずに済むので、方向パッドを出さなくてもスマートフォンで遊べる。
 * 押した先へワープするのではなく、プレイヤーから見た方向へ1歩だけ進む
 * （→ ui/input.ts の intentFromBoardTap）。
 *
 * 上のクリック委譲とは別に張る。あちらは「押されたボタン」を探す処理で、
 * こちらは座標を読む処理なので、同じ分岐に混ぜると両方が読みにくくなる。
 */
root.addEventListener('click', (event) => {
  // 選択待ちや死亡中は盤面を触らせない。モーダルの裏を操作できてしまう。
  if (state.phase !== 'playing') return;

  const target = event.target;
  if (!(target instanceof Element)) return;
  const board = target.closest('.board');
  if (!board) return;

  const cell = boardCellFromPoint(
    board.getBoundingClientRect(),
    { x: event.clientX, y: event.clientY },
    state.dungeon.width,
    state.dungeon.height,
  );
  if (!cell) return;
  dispatch(intentFromBoardTap(state.player.pos, cell));
});
