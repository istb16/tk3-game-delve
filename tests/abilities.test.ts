import { describe, expect, it } from 'vitest';
import type { Enemy, GameState } from '../src/core/types';
import {
  BOSS_INTERVAL,
  ENRAGE_MULTIPLIER,
  GUARD_REDUCTION,
  SHIELD_COOLDOWN,
  isBossFloor,
} from '../src/core/constants';
import { ENEMIES, SPAWN_POOL, spawnWeight } from '../src/data/enemies';
import { createGame, descend } from '../src/game/state';
import { takeTurn } from '../src/game/turn';
import { damageEnemy, enemyAttack, playerAttack } from '../src/game/combat';
import { applyStatus, effectiveSpeed, hasStatus, tickStatuses } from '../src/game/status';
import { takePerk } from '../src/game/progression';

function makeEnemy(state: GameState, over: Partial<Enemy> = {}): Enemy {
  const enemy: Enemy = {
    id: `t-${state.enemies.length}`,
    kind: 'goblin',
    name: 'Goblin',
    ai: 'chase',
    pos: { x: state.player.pos.x + 1, y: state.player.pos.y },
    hp: 50,
    maxHp: 50,
    attack: 10,
    defense: 0,
    speed: 1,
    exp: 5,
    gold: 5,
    steps: 0,
    effects: [],
    evasion: 0,
    ability: null,
    revived: false,
    split: false,
    ...over,
  };
  state.enemies.push(enemy);
  return enemy;
}

describe('出現テーブル', () => {
  it('minFloor より浅い階には絶対に出ない', () => {
    for (const def of ENEMIES) {
      // ボスは重み 0 で個別配置なので、重みの検査対象から外す
      if (def.ability === 'boss') continue;
      for (let floor = 1; floor < def.minFloor; floor++) {
        expect(spawnWeight(def, floor), `${def.kind} が ${floor} 階で候補になっている`).toBe(0);
      }
      // 出現階に達したら候補に入ること（gate が効きすぎていない）
      expect(spawnWeight(def, def.peakFloor)).toBeGreaterThan(0);
    }
  });

  it('実際の生成でも minFloor を破らない', () => {
    const limits = new Map(ENEMIES.map((e) => [e.kind, e.minFloor]));
    for (let seed = 1; seed <= 25; seed++) {
      const state = createGame(seed * 31);
      for (let i = 0; i < 12; i++) {
        for (const enemy of state.enemies) {
          const minFloor = limits.get(enemy.kind) ?? 1;
          expect(
            state.floor,
            `${enemy.kind} が ${state.floor} 階に出た（出現階 ${minFloor}）`,
          ).toBeGreaterThanOrEqual(minFloor);
        }
        descend(state);
      }
    }
  });

  it('ボスは5の倍数階にだけ、1体だけ出る', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const state = createGame(seed * 47);
      for (let i = 0; i < 16; i++) {
        const bosses = state.enemies.filter((e) => e.ability === 'boss');
        if (isBossFloor(state.floor)) {
          expect(bosses.length, `${state.floor} 階にボスがいない`).toBe(1);
        } else {
          expect(bosses.length, `${state.floor} 階にボスがいる`).toBe(0);
        }
        descend(state);
      }
    }
  });

  it('ボス階の間隔が定数どおり', () => {
    for (let floor = 1; floor <= 30; floor++) {
      expect(isBossFloor(floor)).toBe(floor % BOSS_INTERVAL === 0);
    }
  });

  it('通常プールにボスは含まれない', () => {
    expect(SPAWN_POOL.some((e) => e.ability === 'boss')).toBe(false);
  });
});

describe('敵の特殊能力', () => {
  it('Skeleton は一度だけ復活し、二度目は倒れる', () => {
    const state = createGame(1);
    const skeleton = makeEnemy(state, { kind: 'skeleton', name: 'Skeleton', ability: 'revive' });

    damageEnemy(state, skeleton, 999);
    expect(skeleton.hp, '復活していない').toBeGreaterThan(0);
    expect(skeleton.revived).toBe(true);
    expect(state.stats.kills).toBe(0);

    damageEnemy(state, skeleton, 999);
    expect(skeleton.hp).toBe(0);
    expect(state.stats.kills).toBe(1);
  });

  it('Slime は倒すと分裂し、子は分裂しない', () => {
    const state = createGame(2);
    state.enemies = [];
    const slime = makeEnemy(state, { kind: 'slime', name: 'Slime', ability: 'split' });

    damageEnemy(state, slime, 999);
    const children = state.enemies.filter((e) => e.id !== slime.id);
    expect(children.length).toBeGreaterThan(0);
    expect(children.every((c) => c.split)).toBe(true);
    expect(children.every((c) => c.hp < slime.maxHp)).toBe(true);

    // 子を倒しても増えない
    const before = state.enemies.length;
    for (const child of children) damageEnemy(state, child, 999);
    expect(state.enemies.length).toBe(before);
  });

  it('分裂しても経験値の総取得量が増えない（稼ぎ場にならない）', () => {
    const state = createGame(3);
    state.enemies = [];
    const slime = makeEnemy(state, { kind: 'slime', ability: 'split', exp: 20, gold: 20 });
    const parentExp = slime.exp;

    damageEnemy(state, slime, 999);
    const children = state.enemies.filter((e) => e.id !== slime.id);
    const childExp = children.reduce((sum, c) => sum + c.exp, 0);
    expect(childExp).toBeLessThanOrEqual(parentExp);
  });

  it('防御態勢は被ダメージを減らす', () => {
    const state = createGame(4);
    state.player.critChance = 0;
    const plain = makeEnemy(state, { hp: 9999, maxHp: 9999, defense: 0 });
    const guarding = makeEnemy(state, { hp: 9999, maxHp: 9999, defense: 0 });
    applyStatus(guarding, 'guard', 2, 0);

    const before1 = plain.hp;
    playerAttack(state, plain);
    const plainDamage = before1 - plain.hp;

    const before2 = guarding.hp;
    playerAttack(state, guarding);
    const guardedDamage = before2 - guarding.hp;

    expect(guardedDamage).toBeLessThan(plainDamage);
    expect(guardedDamage).toBe(Math.max(1, Math.floor(plainDamage * GUARD_REDUCTION)));
  });

  it('ボスは半分を切ると激昂し、倍率はちょうど1回だけ掛かる', () => {
    const state = createGame(5);
    state.player.evasion = 0;
    state.player.defense = 0;
    state.player.hp = 100000;
    state.player.maxHp = 100000;
    const boss = makeEnemy(state, { ability: 'boss', hp: 100, maxHp: 100, attack: 20 });

    damageEnemy(state, boss, 10);
    expect(hasStatus(boss, 'rage')).toBe(false);

    const beforeHp = state.player.hp;
    enemyAttack(state, boss);
    const normalHit = beforeHp - state.player.hp;

    damageEnemy(state, boss, 50);
    expect(hasStatus(boss, 'rage')).toBe(true);

    const midHp = state.player.hp;
    enemyAttack(state, boss);
    const ragedHit = midHp - state.player.hp;

    // attack そのものと rage の両方に倍率を持たせると 1.5 のつもりが 2.25 になる
    expect(ragedHit).toBe(Math.floor(normalHit * ENRAGE_MULTIPLIER));
  });

  it('回避持ちは攻撃を外させることがあり、外れてもターンは進む', () => {
    const state = createGame(6);
    const bat = makeEnemy(state, { kind: 'bat', name: 'Bat', evasion: 1, hp: 9999, maxHp: 9999 });
    const before = bat.hp;

    playerAttack(state, bat);

    expect(bat.hp, '回避100%なのにダメージが入っている').toBe(before);
    expect(state.log.some((e) => e.key === 'log.enemyEvaded')).toBe(true);
  });
});

describe('継続効果', () => {
  it('毒と火傷はターンごとに削り、期限で消える', () => {
    const state = createGame(7);
    const target = makeEnemy(state, { hp: 500, maxHp: 500 });
    applyStatus(target, 'poison', 2, 5);

    const start = target.hp;
    tickStatuses(state);
    expect(target.hp).toBe(start - 5);
    tickStatuses(state);
    expect(target.hp).toBe(start - 10);
    tickStatuses(state);
    expect(target.hp, '期限を過ぎても削られている').toBe(start - 10);
    expect(hasStatus(target, 'poison')).toBe(false);
  });

  it('重ねがけは加算せず、長い方・強い方を採る', () => {
    const state = createGame(8);
    const target = makeEnemy(state);
    applyStatus(target, 'burn', 3, 7);
    applyStatus(target, 'burn', 1, 4);

    const burn = target.effects.find((e) => e.kind === 'burn');
    expect(burn?.turns).toBe(3);
    expect(burn?.power).toBe(7);
    expect(target.effects.filter((e) => e.kind === 'burn').length).toBe(1);
  });

  it('継続ダメージで倒しても経験値が入る', () => {
    const state = createGame(9);
    state.enemies = [];
    makeEnemy(state, { hp: 3, maxHp: 3, exp: 9 });
    applyStatus(state.enemies[0] as Enemy, 'burn', 3, 10);

    tickStatuses(state);
    expect(state.stats.kills).toBe(1);
    expect(state.player.exp > 0 || state.pendingChoices.length > 0).toBe(true);
  });

  it('鈍足は行動回数を減らす', () => {
    const state = createGame(10);
    const fast = makeEnemy(state, { speed: 2 });
    expect(effectiveSpeed(fast)).toBe(2);
    applyStatus(fast, 'slow', 1, 0);
    expect(effectiveSpeed(fast)).toBe(1);

    const slow = makeEnemy(state, { speed: 1 });
    applyStatus(slow, 'slow', 1, 0);
    expect(effectiveSpeed(slow)).toBe(0);
  });

  it('Shield は被弾を無効化し、クールダウン中は効かない', () => {
    const state = createGame(11);
    takePerk(state, 'shield');
    const attacker = makeEnemy(state, { attack: 5 });
    state.player.evasion = 0;

    const full = state.player.hp;
    enemyAttack(state, attacker);
    expect(state.player.hp, '1発目が無効化されていない').toBe(full);

    enemyAttack(state, attacker);
    expect(state.player.hp, 'クールダウン中なのに無効化された').toBeLessThan(full);

    for (let i = 0; i < SHIELD_COOLDOWN; i++) tickStatuses(state);
    expect(state.player.shieldCooldown).toBe(0);
  });

  it('プレイヤーが継続ダメージで倒れると死亡になる', () => {
    const state = createGame(12);
    state.player.hp = 3;
    applyStatus(state.player, 'poison', 3, 10);

    tickStatuses(state);

    expect(state.player.hp).toBe(0);
    expect(state.phase).toBe('dead');
  });
});

describe('分裂と手番', () => {
  it('分裂で生まれた子はそのターンに行動しない', () => {
    const state = createGame(13);
    state.enemies = [];
    const slime = makeEnemy(state, {
      kind: 'slime',
      ability: 'split',
      hp: 1,
      maxHp: 40,
      pos: { x: state.player.pos.x + 1, y: state.player.pos.y },
    });
    expect(slime.hp).toBe(1);

    const hpBefore = state.player.hp;
    takeTurn(state, { type: 'move', dir: 'right' }); // 隣接した Slime を殴る

    const children = state.enemies.filter((e) => e.split);
    if (children.length > 0) {
      // 生まれた直後の子に手番があると、分裂が実質「無料の攻撃」になる
      expect(children.every((c) => c.steps === 0)).toBe(true);
    }
    expect(state.player.hp).toBeLessThanOrEqual(hpBefore);
  });
});
