import './styles/main.css';

import type { GameState, Intent } from './core/types';
import { createGame } from './game/state';
import { takeTurn } from './game/turn';
import { tileIndex } from './game/dungeon';
import { render } from './ui/view';
import { intentFromDpad, intentFromKey, isGameKey } from './ui/input';
import { installFavicon } from './ui/favicon';
import type { DpadMode, Lang, Settings } from './storage/settings';
import { loadSettings, saveSettings } from './storage/settings';
import type { RunOutcome, SaveData } from './storage/save';
import { loadSave, recordRun } from './storage/save';
import { addLog } from './core/log';

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
let state: GameState = createGame();
draw();

function draw(): void {
  render(root, state, { settings, save, lastRun });
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

    takeTurn(state, intent);

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
  }
  draw();
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
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest(
    '[data-dir], [data-action], [data-set-lang], [data-set-dpad], [data-use-slot], [data-choose]',
  );
  if (!(button instanceof HTMLElement)) return;

  const lang = button.dataset['setLang'];
  if (lang === 'en' || lang === 'ja') {
    updateSettings({ lang: lang as Lang });
    return;
  }

  const dpad = button.dataset['setDpad'];
  if (dpad === 'auto' || dpad === 'on' || dpad === 'off') {
    updateSettings({ dpad: dpad as DpadMode });
    return;
  }

  const choose = button.dataset['choose'];
  if (choose !== undefined) {
    dispatch({ type: 'choose', index: Number(choose) });
    return;
  }

  const slot = button.dataset['useSlot'];
  if (slot !== undefined) {
    dispatch({ type: 'useItem', slot: Number(slot) });
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
