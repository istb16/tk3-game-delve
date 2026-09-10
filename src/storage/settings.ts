/**
 * ユーザー設定の永続化。
 *
 * localStorage が使えない環境（プライベートモード、サイトデータをブロックする設定）でも
 * ゲームが起動しなくなることは絶対に避ける。読み書きは常に握りつぶし、
 * 失敗したらメモリ上の値だけで動作を継続する。
 */

export type Lang = 'en' | 'ja';

/** 'auto' は画面サイズとポインタ種別で自動判定する（CSS 側で解決する）。 */
export type DpadMode = 'auto' | 'on' | 'off';

export interface Settings {
  lang: Lang;
  dpad: DpadMode;
  /**
   * 効果音。既定は OFF。
   *
   * 開いた瞬間に音が出るページは、それだけで閉じられる理由になる。
   * 鳴らすかどうかはプレイヤーが決める（docs/01 FR-12）。
   */
  sound: boolean;
  /**
   * サイドパネルのどちらを見せるか（狭い画面でのタブ）。
   *
   * これは純粋な見た目の状態だが、設定として保存する。
   * 「一度選んだ表示が次に開いた時も残る」方が、UI 側に一時的な状態を
   * 抱えるより素直で、再描画で消えることもない。
   */
  panel: PanelTab;
}

/**
 * サイドパネルのタブ。
 *
 * 狭い画面では装備・ログ・方向キー・設定が同じ高さを奪い合う。1つだけ見せることで
 * iPhone の縦画面でもスクロールせずに全部へ手が届く。
 *
 * 設定もここに混ぜる。専用の開閉ボタンを別行に置くと、それだけで
 * 1行ぶんの高さを常時奪う（盤面はその1行を削って描かれる）。
 */
export type PanelTab = 'gear' | 'log' | 'dpad' | 'settings';

/** バージョンをキー名に含める。スキーマを変えた時に旧データを壊さず無視できる。 */
const STORAGE_KEY = 'delve.settings.v1';

function detectLang(): Lang {
  const nav = typeof navigator === 'undefined' ? '' : navigator.language;
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function defaultSettings(): Settings {
  return { lang: detectLang(), dpad: 'auto', sound: false, panel: 'gear' };
}

const LANGS: readonly Lang[] = ['en', 'ja'];
const DPAD_MODES: readonly DpadMode[] = ['auto', 'on', 'off'];
const PANEL_TABS: readonly PanelTab[] = ['gear', 'log', 'dpad', 'settings'];

export function loadSettings(): Settings {
  const fallback = defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;

    const record = parsed as Record<string, unknown>;
    // 保存値をそのまま信用せず、既知の値だけを受け入れる。
    // 手で書き換えられた localStorage で未定義の状態にならないようにするため。
    const lang = LANGS.find((v) => v === record['lang']) ?? fallback.lang;
    const dpad = DPAD_MODES.find((v) => v === record['dpad']) ?? fallback.dpad;
    const sound = typeof record['sound'] === 'boolean' ? record['sound'] : fallback.sound;
    const panel = PANEL_TABS.find((v) => v === record['panel']) ?? fallback.panel;
    return { lang, dpad, sound, panel };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても続行する。設定はゲームの進行に必須ではない。
  }
}
