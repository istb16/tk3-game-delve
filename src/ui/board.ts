import type { GameState } from '../core/types';
import { tileAt, tileIndex } from '../game/dungeon';
import {
  FLOOR_SPRITE,
  PLAYER_SPRITE,
  STAIRS_SPRITE,
  WALL_SPRITE,
  enemySprite,
} from './sprites';

/**
 * ダンジョンを1枚の SVG として組み立てる。
 *
 * viewBox を "0 0 width height" にしておけば、CSS 側で width:100% にするだけで
 * レスポンシブが成立する。タイル数は 225 程度なので毎ターンの全再構築で十分速い。
 */
export function renderBoard(state: GameState): string {
  const d = state.dungeon;
  const parts: string[] = [];

  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const i = tileIndex(d, x, y);
      // 未探索のマスは描かない。フォグの外側は「まだ存在しない」
      if (!d.explored[i]) continue;

      const dim = d.visible[i] ? '' : ' tile--dim';
      const kind = tileAt(d, x, y);
      const sprite =
        kind === 'wall' ? WALL_SPRITE : kind === 'stairs' ? STAIRS_SPRITE : FLOOR_SPRITE;

      parts.push(
        `<g class="tile tile--${kind}${dim}" transform="translate(${x},${y})">${sprite}</g>`,
      );
    }
  }

  // 敵は見えているマスにいるときだけ描く（暗闇の向こうの敵は見えない）
  for (const enemy of state.enemies) {
    if (!d.visible[tileIndex(d, enemy.pos.x, enemy.pos.y)]) continue;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    parts.push(
      `<g class="actor actor--enemy actor--${enemy.kind}" transform="translate(${enemy.pos.x},${enemy.pos.y})">` +
        `${enemySprite(enemy.kind)}` +
        `<rect class="actor__hp-track" x="0.15" y="0.06" width="0.7" height="0.07" rx="0.035" />` +
        `<rect class="actor__hp-fill" x="0.15" y="0.06" width="${(0.7 * hpRatio).toFixed(3)}" height="0.07" rx="0.035" />` +
        `</g>`,
    );
  }

  parts.push(
    `<g class="actor actor--player" transform="translate(${state.player.pos.x},${state.player.pos.y})">${PLAYER_SPRITE}</g>`,
  );

  return (
    `<svg class="board" viewBox="0 0 ${d.width} ${d.height}" role="img" aria-label="Dungeon map">` +
    parts.join('') +
    `</svg>`
  );
}
