import type { LogKey } from '../core/types';
import type { SoundId } from '../audio/sfx';
import { play } from '../audio/sfx';

/**
 * 「何が起きたか」を音に変える。
 *
 * ログのキーから引くのが要点。game/ は音の存在を知らないままでよく、
 * 新しい出来事にログを足せば音も自然に付く。
 */
const SOUND_BY_LOG: Partial<Record<LogKey, SoundId>> = {
  'log.critical': 'critical',
  'log.playerHit': 'hit',
  'log.enemyHit': 'hurt',
  'log.statusTick': 'hurt',
  'log.enemyDies': 'kill',
  'log.levelUp': 'levelUp',
  'log.pickup': 'pickup',
  'log.usePotion': 'pickup',
  'log.equip': 'pickup',
  'log.useScroll': 'pickup',
  'log.pickupGold': 'gold',
  'log.openChest': 'gold',
  'log.useKey': 'gold',
  'log.scrollBlast': 'critical',
  'log.scrollReveal': 'pickup',
  'log.scrollTeleport': 'descend',
  'log.scrollRage': 'levelUp',
  'log.scrollBanish': 'kill',
  'log.scrollCurse': 'hurt',
  'log.floor': 'descend',
  'log.died': 'died',
  'log.achievement': 'achievement',
};

/**
 * 1ターンで積まれたログから音を鳴らす。
 *
 * 同じ音は1回にまとめ、鳴らす数は上限を設ける。
 * 1手で敵が5体動くと被弾音が5連続して耳に障るため。
 */
const MAX_SOUNDS_PER_TURN = 3;

export function playCues(keys: readonly LogKey[]): void {
  const queued: SoundId[] = [];
  for (const key of keys) {
    const sound = SOUND_BY_LOG[key];
    if (!sound || queued.includes(sound)) continue;
    queued.push(sound);
    if (queued.length >= MAX_SOUNDS_PER_TURN) break;
  }
  for (const sound of queued) play(sound);
}
