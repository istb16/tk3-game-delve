import './styles/main.css';

import type { GameState, Intent } from './core/types';
import { createGame } from './game/state';
import { takeTurn } from './game/turn';
import { render } from './ui/view';
import { intentFromDpad, intentFromKey } from './ui/input';

const container = document.getElementById('app');
if (!container) throw new Error('#app not found');
// 明示的に型を確定させる。以降のクロージャで null チェックを繰り返さないため。
const root: HTMLElement = container;

let state: GameState = createGame();
render(root, state);

/**
 * Intent を1つ処理して再描画する。
 * ゲームは入力駆動なので、ここが唯一の状態進行の入口になる。
 */
function dispatch(intent: Intent): void {
  if (intent.type === 'restart') {
    // 死亡中のみ再開を受け付ける。プレイ中の誤爆で Run が消えるのを防ぐ。
    if (state.phase !== 'dead') return;
    state = createGame();
  } else {
    takeTurn(state, intent);
  }
  render(root, state);
}

window.addEventListener('keydown', (event) => {
  const intent = intentFromKey(event);
  if (!intent) return;
  event.preventDefault();
  dispatch(intent);
});

// 方向パッドと DELVE AGAIN。render() で DOM を作り直すため、
// 個別要素ではなく root への委譲でハンドラを1つに保つ。
root.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest('[data-dir], [data-action]');
  if (!(button instanceof HTMLElement)) return;

  if (button.dataset['action'] === 'restart') {
    dispatch({ type: 'restart' });
    return;
  }

  const dir = button.dataset['dir'];
  if (!dir) return;
  const intent = intentFromDpad(dir);
  if (intent) dispatch(intent);
});
