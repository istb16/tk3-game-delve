import type { EnemyKind } from '../core/types';

/**
 * インライン SVG スプライト。外部画像を一切使わないための中核。
 *
 * すべて 1x1 の座標系で描く。ボードは viewBox="0 0 15 15" なので、
 * <g transform="translate(x,y)"> の中にそのまま入れれば 1 マスに収まる。
 * 描き込みすぎず、シルエットで判別できることを優先する。
 */

export const FLOOR_SPRITE = `
  <rect class="tile__base tile__base--floor" width="1" height="1" />
  <rect class="tile__grid" x="0.02" y="0.02" width="0.96" height="0.96" rx="0.06" />
`;

export const WALL_SPRITE = `
  <rect class="tile__base tile__base--wall" width="1" height="1" rx="0.1" />
  <path class="tile__wall-edge" d="M0.12 0.16 H0.88" />
`;

export const STAIRS_SPRITE = `
  <rect class="tile__base tile__base--floor" width="1" height="1" />
  <path class="sprite__stairs" d="M0.2 0.78 H0.44 V0.6 H0.62 V0.42 H0.8" />
  <path class="sprite__stairs-riser" d="M0.2 0.78 V0.86 M0.44 0.6 V0.78 M0.62 0.42 V0.6" />
`;

export const PLAYER_SPRITE = `
  <circle class="sprite__glow" cx="0.5" cy="0.5" r="0.46" />
  <circle class="sprite__player-head" cx="0.5" cy="0.33" r="0.13" />
  <path class="sprite__player-body" d="M0.5 0.46 L0.72 0.8 H0.28 Z" />
`;

const ENEMY_SPRITES: Record<EnemyKind, string> = {
  rat: `
    <ellipse class="sprite__enemy" cx="0.46" cy="0.6" rx="0.24" ry="0.16" />
    <circle class="sprite__enemy" cx="0.66" cy="0.52" r="0.1" />
    <path class="sprite__enemy-line" d="M0.22 0.62 q-0.14 0.06 -0.1 0.18" />
  `,
  goblin: `
    <path class="sprite__enemy" d="M0.5 0.2 L0.72 0.46 H0.28 Z" />
    <rect class="sprite__enemy" x="0.32" y="0.48" width="0.36" height="0.3" rx="0.06" />
    <circle class="sprite__enemy-eye" cx="0.42" cy="0.36" r="0.035" />
    <circle class="sprite__enemy-eye" cx="0.58" cy="0.36" r="0.035" />
  `,
  bat: `
    <circle class="sprite__enemy" cx="0.5" cy="0.5" r="0.13" />
    <path class="sprite__enemy" d="M0.37 0.46 L0.1 0.3 L0.16 0.62 Z" />
    <path class="sprite__enemy" d="M0.63 0.46 L0.9 0.3 L0.84 0.62 Z" />
  `,
  skeleton: `
    <circle class="sprite__enemy" cx="0.5" cy="0.36" r="0.16" />
    <circle class="sprite__enemy-socket" cx="0.44" cy="0.35" r="0.045" />
    <circle class="sprite__enemy-socket" cx="0.56" cy="0.35" r="0.045" />
    <path class="sprite__enemy-line" d="M0.34 0.62 H0.66 M0.36 0.72 H0.64 M0.38 0.82 H0.62" />
  `,
  slime: `
    <path class="sprite__enemy" d="M0.16 0.8 q0.04 -0.44 0.34 -0.44 q0.3 0 0.34 0.44 Z" />
    <circle class="sprite__enemy-eye" cx="0.42" cy="0.62" r="0.04" />
    <circle class="sprite__enemy-eye" cx="0.58" cy="0.62" r="0.04" />
  `,
  warden: `
    <path class="sprite__enemy" d="M0.5 0.12 L0.8 0.34 V0.7 L0.5 0.9 L0.2 0.7 V0.34 Z" />
    <path class="sprite__enemy-core" d="M0.5 0.36 L0.62 0.51 L0.5 0.66 L0.38 0.51 Z" />
  `,
  boss: `
    <path class="sprite__enemy" d="M0.5 0.06 L0.88 0.3 V0.74 L0.5 0.96 L0.12 0.74 V0.3 Z" />
    <path class="sprite__enemy-core" d="M0.5 0.24 L0.72 0.5 L0.5 0.76 L0.28 0.5 Z" />
    <circle class="sprite__enemy-eye" cx="0.5" cy="0.5" r="0.08" />
  `,
};

export function enemySprite(kind: EnemyKind): string {
  return ENEMY_SPRITES[kind];
}
