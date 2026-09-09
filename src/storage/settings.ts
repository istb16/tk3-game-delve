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
}

/** バージョンをキー名に含める。スキーマを変えた時に旧データを壊さず無視できる。 */
const STORAGE_KEY = 'delve.settings.v1';

function detectLang(): Lang {
  const nav = typeof navigator === 'undefined' ? '' : navigator.language;
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function defaultSettings(): Settings {
  return { lang: detectLang(), dpad: 'auto' };
}

const LANGS: readonly Lang[] = ['en', 'ja'];
const DPAD_MODES: readonly DpadMode[] = ['auto', 'on', 'off'];

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
    return { lang, dpad };
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
