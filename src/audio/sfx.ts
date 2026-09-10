/**
 * 効果音。外部音声ファイルは使わず、Web Audio API で**生成**する。
 *
 * 音源を持たないので、鳴らせるのは矩形波・三角波とノイズの組み合わせだけ。
 * 当時のゲーム機と同じ制約なので、ドット絵と相性がいい。
 *
 * ここは ui/ 層に属する（DOM/ブラウザ API を触る）。game/ から直接呼ばない。
 */

export type SoundId =
  | 'hit'
  | 'critical'
  | 'hurt'
  | 'kill'
  | 'levelUp'
  | 'pickup'
  | 'gold'
  | 'descend'
  | 'died'
  | 'achievement'
  | 'select';

interface Tone {
  /** 波形 */
  type: OscillatorType;
  /** 開始周波数 (Hz) */
  from: number;
  /** 終了周波数 (Hz)。from と同じなら一定 */
  to: number;
  /** 長さ (秒) */
  duration: number;
  /** 音量 (0..1) */
  gain: number;
  /** 開始を遅らせる (秒)。和音やアルペジオを作るのに使う */
  delay?: number;
}

/**
 * 音の定義。
 *
 * 短く（0.2秒以下）、低音量に保つ。ターン制ゲームは1手ごとに音が鳴るので、
 * 長い音や大きい音はすぐ耳に障る。
 */
const SOUNDS: Readonly<Record<SoundId, readonly Tone[]>> = {
  hit: [{ type: 'square', from: 220, to: 110, duration: 0.07, gain: 0.16 }],
  critical: [
    { type: 'square', from: 420, to: 140, duration: 0.1, gain: 0.2 },
    { type: 'square', from: 700, to: 300, duration: 0.08, gain: 0.12, delay: 0.03 },
  ],
  hurt: [{ type: 'sawtooth', from: 160, to: 60, duration: 0.12, gain: 0.18 }],
  kill: [{ type: 'triangle', from: 180, to: 40, duration: 0.16, gain: 0.18 }],
  levelUp: [
    { type: 'square', from: 523, to: 523, duration: 0.09, gain: 0.14 },
    { type: 'square', from: 659, to: 659, duration: 0.09, gain: 0.14, delay: 0.08 },
    { type: 'square', from: 784, to: 784, duration: 0.14, gain: 0.14, delay: 0.16 },
  ],
  pickup: [{ type: 'square', from: 660, to: 990, duration: 0.06, gain: 0.12 }],
  gold: [
    { type: 'square', from: 880, to: 880, duration: 0.05, gain: 0.12 },
    { type: 'square', from: 1320, to: 1320, duration: 0.06, gain: 0.1, delay: 0.05 },
  ],
  descend: [{ type: 'triangle', from: 330, to: 110, duration: 0.2, gain: 0.16 }],
  died: [
    { type: 'sawtooth', from: 220, to: 55, duration: 0.4, gain: 0.2 },
    { type: 'square', from: 110, to: 40, duration: 0.4, gain: 0.12, delay: 0.05 },
  ],
  achievement: [
    { type: 'square', from: 784, to: 784, duration: 0.08, gain: 0.13 },
    { type: 'square', from: 1046, to: 1046, duration: 0.16, gain: 0.13, delay: 0.08 },
  ],
  select: [{ type: 'square', from: 440, to: 660, duration: 0.05, gain: 0.1 }],
};

/**
 * AudioContext は最初に鳴らす時まで作らない。
 *
 * ページを開いた時点で作ると、ブラウザの自動再生ポリシーで suspended になったまま
 * 残り続ける。ユーザーの操作の中で作れば、そのまま鳴る状態で始まる。
 */
let context: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  if (!value) return;
  // 有効化そのものがクリック操作の中で起きるので、ここで作るのが最も確実。
  ensureContext();
}

function ensureContext(): AudioContext | null {
  if (context) {
    // タブを離れて戻ると suspended になることがある
    if (context.state === 'suspended') void context.resume();
    return context;
  }
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    return context;
  } catch {
    // 音が出せない環境でもゲームは続く。音は進行に必須ではない。
    return null;
  }
}

export function play(id: SoundId): void {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  for (const tone of SOUNDS[id]) {
    try {
      emit(ctx, tone, now);
    } catch {
      // 1つ鳴らなくても他を止めない
    }
  }
}

function emit(ctx: AudioContext, tone: Tone, now: number): void {
  const start = now + (tone.delay ?? 0);
  const end = start + tone.duration;

  const osc = ctx.createOscillator();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.from, start);
  if (tone.to !== tone.from) osc.frequency.exponentialRampToValueAtTime(tone.to, end);

  const gain = ctx.createGain();
  // 立ち上がりを一瞬だけ持たせる。0 から直接だとプチッというクリック音が乗る。
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}
