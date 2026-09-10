import type { Actor, GameState } from '../core/types';
import type { Settings } from '../storage/settings';
import { tileAt, tileIndex } from '../game/dungeon';
import { spriteSymbol } from './pixel';
import { allSprites, enemySpriteId, entitySpriteId, playerSpriteId, tileSpriteId } from './sprites';
import { hasPerk } from '../game/progression';
import { t } from './i18n';

/**
 * ダンジョンを1枚の SVG として組み立てる。
 *
 * スプライトは <defs> の <symbol> に一度だけ定義し、各タイルは <use> で参照する。
 * 要素数は <use> 225 個 + 定義 11 個に収まる。
 *
 * viewBox を "0 0 width height" にしておけば、CSS 側で width:100% にするだけで
 * レスポンシブが成立する。
 */

/** <defs> の中身は毎ターン変わらないので一度だけ構築する。 */
let cachedDefs: string | null = null;

function defs(): string {
  if (cachedDefs === null) {
    cachedDefs =
      '<defs>' +
      allSprites()
        .map(({ id, def, frame }) => spriteSymbol(id, def, frame))
        .join('') +
      '</defs>';
  }
  return cachedDefs;
}

/** 歩行フレームは累積歩数から導出する。UI 側にアニメーション状態を持たない。 */
function frameOf(actor: Actor): number {
  return actor.steps % 2;
}

export function renderBoard(state: GameState, settings: Settings): string {
  const d = state.dungeon;
  const parts: string[] = [];

  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const i = tileIndex(d, x, y);
      // 未探索のマスは描かない。フォグの外側は「まだ存在しない」
      if (!d.explored[i]) continue;

      const kind = tileAt(d, x, y);
      const dim = d.visible[i] ? '' : ' tile--dim';
      parts.push(
        `<use href="#${tileSpriteId(kind)}" x="${x}" y="${y}" width="1" height="1" class="tile${dim}"/>`,
      );
    }
  }

  // 床に落ちている物。敵より先に描いて下に置く。
  // Treasure Sense を持っていると、宝箱とゴールドだけは視界の外でも探索済みなら見える。
  const senses = hasPerk(state.player, 'treasureSense');
  for (const entity of state.entities) {
    const i = tileIndex(d, entity.pos.x, entity.pos.y);
    const treasure = entity.payload.type === 'chest' || entity.payload.type === 'gold';
    const sensed = senses && treasure && d.explored[i];
    if (!d.visible[i] && !sensed) continue;
    const dim = d.visible[i] ? '' : ' tile--dim';
    parts.push(
      `<use class="entity${dim}" href="#${entitySpriteId(entity)}"` +
        ` x="${entity.pos.x}" y="${entity.pos.y}" width="1" height="1"/>`,
    );
  }

  // 敵は見えているマスにいるときだけ描く（暗闇の向こうの敵は見えない）
  for (const enemy of state.enemies) {
    if (!d.visible[tileIndex(d, enemy.pos.x, enemy.pos.y)]) continue;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    // 状態異常は盤面でも分かるようにする。ログを遡らないと分からない状態は、
    // 「今どうなっているか」を判断材料にできない。
    const marks = enemy.effects
      .filter((e) => e.turns > 0)
      .map((e) => ` actor--${e.kind}`)
      .join('');
    // 被弾演出も状態から導出する。UI 側にフラグを持たない（CLAUDE.md の境界5）
    const hurt = enemy.hurtOnTurn === state.turn ? ' actor--hurt' : '';
    parts.push(
      `<g class="actor actor--enemy actor--${enemy.kind}${marks}${hurt}">` +
        `<use href="#${enemySpriteId(enemy.kind, frameOf(enemy))}" x="${enemy.pos.x}" y="${enemy.pos.y}" width="1" height="1"/>` +
        `<rect class="actor__hp-track" x="${enemy.pos.x + 0.15}" y="${enemy.pos.y + 0.02}" width="0.7" height="0.07" rx="0.035"/>` +
        `<rect class="actor__hp-fill" x="${enemy.pos.x + 0.15}" y="${enemy.pos.y + 0.02}" width="${(0.7 * hpRatio).toFixed(3)}" height="0.07" rx="0.035"/>` +
        `</g>`,
    );
  }

  const p = state.player;
  const playerHurt = p.hurtOnTurn === state.turn ? ' actor--hurt' : '';
  parts.push(
    `<g class="actor actor--player${playerHurt}">` +
      `<circle class="actor__torch" cx="${p.pos.x + 0.5}" cy="${p.pos.y + 0.5}" r="0.9"/>` +
      `<use href="#${playerSpriteId(frameOf(p))}" x="${p.pos.x}" y="${p.pos.y}" width="1" height="1"/>` +
      `</g>`,
  );

  const label = t(settings.lang, 'aria.board', {
    floor: state.floor,
    x: p.pos.x + 1,
    y: p.pos.y + 1,
  });

  // ダメージ数値は最後に描く。何にも隠れないようにするため。
  for (const actor of [state.player, ...state.enemies]) {
    if (actor.hurtOnTurn !== state.turn || actor.lastDamage <= 0) continue;
    if (!d.visible[tileIndex(d, actor.pos.x, actor.pos.y)]) continue;
    parts.push(
      `<text class="damage" x="${actor.pos.x + 0.5}" y="${actor.pos.y + 0.3}">` +
        `${actor.lastDamage}</text>`,
    );
  }

  return (
    `<svg class="board" viewBox="0 0 ${d.width} ${d.height}" shape-rendering="crispEdges"` +
    ` role="img" aria-label="${label}">` +
    defs() +
    parts.join('') +
    `</svg>`
  );
}
