/**
 * ドット絵 -> SVG 変換。
 *
 * 外部画像を使えないため、16x16 のドット絵をテキストで持ち、実行時に SVG へ変換する。
 * 1ピクセル = 1 <rect> で素直に描くと 15x15 タイル x 256px = 57,600 要素になり破綻するので、
 *   1. スプライトは <defs> の <symbol> に一度だけ定義し、各タイルは <use> で参照する
 *   2. 同じ色が横に連続する区間を 1 つの <rect> にまとめる
 * の 2 段階で要素数を削る。詳細は docs/05-ui-design.md。
 */

export interface SpriteDef {
  /** インデックス -> CSS 色。1スプライトあたり最大16色 */
  palette: readonly string[];
  /** frames[frameIndex][row] = 16文字の行。'.' は透明、'0'-'f' はパレット番号 */
  frames: readonly (readonly string[])[];
}

export const SPRITE_SIZE = 16;

/**
 * 隣接する rect の間にできる髪の毛のような隙間を防ぐための重ね幅。
 * タイルが非整数ピクセルに拡大されると、境界に背景が透けることがある。
 */
const SEAM = 0.02;

/**
 * スプライト定義の妥当性を検査する。
 *
 * ドット絵は 16 文字 x 16 行の手書きテキストなので、1 文字の過不足が起きやすい。
 * 描画時に静かに崩れるより、起動時に明確に落ちる方が直しやすい。
 */
export function validateSprite(name: string, def: SpriteDef): void {
  if (def.frames.length === 0) throw new Error(`sprite "${name}": frames が空`);

  def.frames.forEach((frame, frameIndex) => {
    if (frame.length !== SPRITE_SIZE) {
      throw new Error(
        `sprite "${name}" frame ${frameIndex}: 行数が ${frame.length}（${SPRITE_SIZE} 行必要）`,
      );
    }
    frame.forEach((row, y) => {
      if (row.length !== SPRITE_SIZE) {
        throw new Error(
          `sprite "${name}" frame ${frameIndex} row ${y}: 幅が ${row.length}（${SPRITE_SIZE} 文字必要）`,
        );
      }
      for (let x = 0; x < row.length; x++) {
        const ch = row[x] as string;
        if (ch === '.') continue;
        const index = parseInt(ch, 16);
        if (Number.isNaN(index) || def.palette[index] === undefined) {
          throw new Error(
            `sprite "${name}" frame ${frameIndex} row ${y} col ${x}: 未定義のパレット番号 '${ch}'`,
          );
        }
      }
    });
  });
}

/** 1 フレームを <rect> の並びに変換する。横方向の同色連続をまとめる。 */
export function spriteRects(def: SpriteDef, frameIndex: number): string {
  const frame = def.frames[frameIndex];
  if (!frame) throw new Error(`frame ${frameIndex} が存在しない`);

  const rects: string[] = [];
  for (let y = 0; y < frame.length; y++) {
    const row = frame[y] as string;
    let runStart = 0;
    let runChar = row[0] as string;

    // 番兵として行末+1まで回し、最後の区間も同じ経路で書き出す
    for (let x = 1; x <= row.length; x++) {
      const ch = x < row.length ? (row[x] as string) : '\0';
      if (ch === runChar) continue;

      if (runChar !== '.') {
        const color = def.palette[parseInt(runChar, 16)] as string;
        const width = (x - runStart + SEAM).toFixed(2);
        rects.push(
          `<rect x="${runStart}" y="${y}" width="${width}" height="${1 + SEAM}" fill="${color}"/>`,
        );
      }
      runStart = x;
      runChar = ch;
    }
  }
  return rects.join('');
}

/** 1 フレームを <symbol> に変換する。id は docs の命名規約に従い `sp-<名前>-<フレーム>`。 */
export function spriteSymbol(id: string, def: SpriteDef, frameIndex: number): string {
  return (
    `<symbol id="${id}" viewBox="0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}">` +
    spriteRects(def, frameIndex) +
    `</symbol>`
  );
}

/** スプライト単体を、それだけで完結する SVG 文字列にする（favicon 用）。 */
export function spriteToStandaloneSvg(def: SpriteDef, frameIndex: number, background: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}" shape-rendering="crispEdges">` +
    `<rect width="${SPRITE_SIZE}" height="${SPRITE_SIZE}" fill="${background}"/>` +
    spriteRects(def, frameIndex) +
    `</svg>`
  );
}
