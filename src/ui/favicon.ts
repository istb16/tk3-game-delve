import { spriteToStandaloneSvg } from './pixel';
import { PLAYER } from './sprites';

/**
 * favicon をプレイヤーのスプライトから生成して埋め込む。
 *
 * 単一 HTML ファイルなので外部の .ico / .png を置けない。data URI にする。
 * HTML 側にドット絵を手書きで複製せず、スプライト定義を唯一の出典にするため
 * 実行時に生成する（絵を直せば favicon も自動で追従する）。
 *
 * JavaScript が動かない環境では favicon が出ないが、その環境ではゲーム自体が
 * 動かないため実害はない。
 */
export function installFavicon(): void {
  // タブの地色に埋もれないよう、暗い背景を敷いてから描く
  const svg = spriteToStandaloneSvg(PLAYER, 0, '#0b0d12');
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const link = existing ?? document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = href;
  if (!existing) document.head.appendChild(link);
}
