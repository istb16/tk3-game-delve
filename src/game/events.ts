import type { Entity, Equipment, EventId, GameState, Slot } from '../core/types';
import { SHOP_PRICE, SHRINE_COST } from '../core/constants';
import { addLog } from '../core/log';
import { equipmentAt, toEquipment, rareEquipmentAt } from '../data/equipment';
import { addBonus, equip } from './progression';
import { healPlayer } from './loot';
import { spawnGuardian } from './enemy';

/**
 * イベントの効果。
 *
 * 設計の原則は「ノーリスクの得を作らない」（docs/03 §3.7）。
 * どの選択肢にも対価か賭けが乗っている。立ち去る選択は常に無料だが、
 * その代わり何も得られない — それも判断のうち。
 */

/** 最後の選択肢は常に「立ち去る」。 */
export function applyEvent(
  state: GameState,
  eventId: EventId,
  entity: Entity | undefined,
  index: number,
): void {
  const rng = state.rng;
  const player = state.player;

  switch (eventId) {
    case 'shrine': {
      if (index !== 0) return decline(state);
      if (player.gold < SHRINE_COST) return poor(state);
      player.gold -= SHRINE_COST;
      // 攻撃力と引き換えに体力を削る。強くなるほど死にやすくなる取引。
      addBonus(player, { attackPct: 0.2, maxHp: -10 });
      addLog(state.log, 'log.shrineBlessed', {}, 'good');
      return;
    }

    case 'merchant': {
      if (index === 0) return buy(state, 'potion');
      if (index === 1) return buy(state, 'equipment');
      return decline(state);
    }

    case 'cursedChest': {
      if (index !== 0) return decline(state);
      if (rng.chance(0.7)) {
        dropAt(state, entity, rareEquipmentAt(state.floor, rng));
        addLog(state.log, 'log.cursedReward', {}, 'good');
      } else {
        const damage = Math.max(1, Math.floor(player.maxHp * 0.25));
        player.hp -= damage;
        addLog(state.log, 'log.cursedTrap', { damage }, 'bad');
        killIfDown(state);
      }
      return;
    }

    case 'healingSpring': {
      if (index !== 0) return decline(state);
      const healed = healPlayer(state, 1);
      // 全回復の対価は「このフロアが2体分うるさくなる」こと。
      const added = spawnGuardian(state, 2);
      addLog(state.log, 'log.springDrunk', { healed, count: added }, 'good');
      return;
    }

    case 'strangeAltar': {
      if (index !== 0) return decline(state);
      const slots: Slot[] = (['weapon', 'armor', 'ring'] as const).filter(
        (slot) => player.equipment[slot] !== null,
      );
      if (slots.length === 0) {
        addLog(state.log, 'log.altarEmpty', {}, 'info');
        return;
      }
      const slot = rng.pick(slots);
      const offered = player.equipment[slot];
      const candidates = equipmentAt(state.floor).filter((e) => e.slot === slot);
      const replacement = toEquipment(rng.pick(candidates));
      // 良くなるとは限らない。捧げるとはそういうこと。
      player.equipment[slot] = null;
      equip(player, replacement);
      addLog(
        state.log,
        'log.altarSwapped',
        { from: offered?.name ?? '-', to: replacement.name },
        'info',
      );
      return;
    }

    case 'hiddenRoom': {
      if (index !== 0) return decline(state);
      const gold = 40 + rng.int(0, 40) + state.floor * 8;
      player.gold += gold;
      state.stats.goldEarned += gold;
      dropItemAt(state, entity, 'potion');
      // 壁を崩す物音で1体寄ってくる
      const added = spawnGuardian(state, 1);
      addLog(state.log, 'log.hiddenRoom', { gold, count: added }, 'gold');
      return;
    }

    case 'treasury': {
      if (index !== 0) return decline(state);
      const gold = 120 + rng.int(0, 80) + state.floor * 15;
      player.gold += gold;
      state.stats.goldEarned += gold;
      const added = spawnGuardian(state, 1, 'warden');
      addLog(state.log, 'log.treasuryTaken', { gold, count: added }, 'gold');
      return;
    }
  }
}

// --- 部品 --------------------------------------------------------------------

function decline(state: GameState): void {
  addLog(state.log, 'log.eventDeclined', {}, 'info');
}

function poor(state: GameState): void {
  addLog(state.log, 'log.merchantPoor', {}, 'bad');
}

function buy(state: GameState, what: 'potion' | 'equipment'): void {
  const price = SHOP_PRICE[what];
  if (state.player.gold < price) return poor(state);

  state.player.gold -= price;
  if (what === 'potion') {
    // 床に置いて拾わせる。満杯なら拾えないことがそのまま伝わる。
    dropItemAt(state, undefined, 'potion');
  } else {
    dropAt(state, undefined, toEquipment(state.rng.pick(equipmentAt(state.floor))));
  }
  addLog(state.log, 'log.merchantBought', { price }, 'gold');
}

/** イベントのマスに置く。マスが分からなければプレイヤーの足元に置く。 */
function dropAt(state: GameState, entity: Entity | undefined, equipment: Equipment): void {
  state.entities.push({
    id: `event-${state.entities.length}-${state.player.steps}`,
    kind: 'equipment',
    pos: { ...(entity?.pos ?? state.player.pos) },
    payload: { type: 'equipment', equipment, declinedAgainst: null },
  });
}

function dropItemAt(state: GameState, entity: Entity | undefined, itemId: 'potion'): void {
  state.entities.push({
    id: `event-item-${state.entities.length}-${state.player.steps}`,
    kind: 'item',
    pos: { ...(entity?.pos ?? state.player.pos) },
    payload: { type: 'item', itemId, count: 1 },
  });
}

function killIfDown(state: GameState): void {
  if (state.player.hp > 0) return;
  state.player.hp = 0;
  state.phase = 'dead';
  addLog(state.log, 'log.died', {}, 'system');
}
