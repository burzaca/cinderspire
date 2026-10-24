import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEntity, Combat, TICK } from '../src/engine.js';
import { makeRng } from '../src/rng.js';

function mkCombat(opts = {}) {
  const rng = makeRng(opts.seed ?? 1);
  const player = makeEntity({ name: 'P', maxHp: 100, atk: 10, atkSpeed: 1, manaRegen: 0, startMana: 100, ...opts.player }, 'player');
  const enemies = (opts.enemies ?? [{ name: 'E', maxHp: 100, atk: 0, atkSpeed: 0 }]).map((e) => makeEntity(e, 'enemy'));
  const c = new Combat({ rng, player, enemies, abilities: opts.abilities ?? [], enemyAbilities: opts.enemyAbilities ?? {} });
  return { c, player, enemies };
}

test('armor mitigates but never below the 15% floor', () => {
  const { c } = mkCombat({ player: { atkSpeed: 0 } });
  const lowArmor = c.rollDamage({ atk: 10, crit: 0, buff: 0, weaken: 0, critMult: 0 }, { armor: 5 });
  assert.ok(lowArmor.dmg >= 10 * 0.9 * 0.8 && lowArmor.dmg <= 10 * 1.1 * 0.8 + 1);
  const highArmor = c.rollDamage({ atk: 10, crit: 0, buff: 0, weaken: 0, critMult: 0 }, { armor: 100 });
  assert.ok(highArmor.dmg <= 10 * 1.1 * 0.15 + 1 && highArmor.dmg >= 1);
});

test('shield absorbs before HP', () => {
  const { c, player } = mkCombat({ player: { atkSpeed: 0 } });
  player.shield = 30;
  c.applyDamage(player, 50);
  assert.equal(player.shield, 0);
  assert.equal(player.hp, 80);
});

test('thorns reflect melee damage back to the attacker', () => {
  const { c, player, enemies } = mkCombat({ player: { atkSpeed: 0 }, enemies: [{ name: 'E', maxHp: 100, atk: 0, atkSpeed: 0, thorns: 7 }] });
  c.applyDamage(enemies[0], 10, player, { melee: true });
  assert.equal(player.hp, 93);
  c.applyDamage(enemies[0], 10, player, { melee: false });
  assert.equal(player.hp, 93, 'ranged/AOE must not trigger thorns');
});

test('lifesteal heals the attacker', () => {
  const { c, player, enemies } = mkCombat({ player: { atkSpeed: 0, lifesteal: 0.5 } });
  player.hp = 50;
  c.applyDamage(enemies[0], 20, player, { melee: true });
  assert.equal(player.hp, 60);
});

test('revive fires once at 35% HP', () => {
  const { c, player, enemies } = mkCombat({ player: { revives: 1, atkSpeed: 0 } });
  c.applyDamage(player, 999);
  assert.ok(player.alive);
  assert.equal(player.hp, 35);
  c.applyDamage(player, 999);
  assert.ok(!player.alive);
  assert.equal(c.done, true);
  assert.equal(c.win, false);
});

test('burn ticks every 2s and scales with burnAmp', () => {
  const { c, enemies } = mkCombat({ player: { atkSpeed: 0 } });
  const e = enemies[0];
  e.burn = 10; e.burnT = 2; e.burnAmp = 0.5;
  for (let i = 0; i < 41; i++) c.step(); // just over 2s
  assert.ok(e.hp <= 100 - 15, `expected burn tick ~15, hp=${e.hp}`);
});

test('curse ticks every 3s at 1.2x stacks', () => {
  const { c, enemies } = mkCombat({ player: { atkSpeed: 0 } });
  const e = enemies[0];
  e.curse = 10; e.curseT = 3;
  for (let i = 0; i < 41; i++) c.step(); // 2.05s: no curse tick yet
  assert.equal(e.hp, 100);
  for (let i = 0; i < 20; i++) c.step(); // past 3s
  assert.equal(e.hp, 88);
});

test('silence locks one enemy ability and expires', () => {
  const enemyAbilities = { E: [{ id: 'x', name: 'X', cost: 0, cooldown: 0, power: 5, ai: 1 }] };
  const { c, enemies } = mkCombat({
    player: { atkSpeed: 0 },
    abilities: [{ id: 's', def: { id: 's', name: 'S', cost: 0, cooldown: 0, silence: 5 } }],
    enemyAbilities,
  });
  const e = enemies[0];
  e.mana = 999;
  c.cast(c.player, c.abilities[0].def, 0);
  assert.ok(e.silenceT > 0 && e.silencedId === 'x');
  const pBefore = c.player.hp;
  for (let i = 0; i < 40; i++) c.step(TICK); // 2s of enemy cast windows
  assert.equal(c.player.hp, pBefore, 'silenced enemy must not cast');
  for (let i = 0; i < 120; i++) c.step(TICK); // 6s more: silence expired
  assert.ok(e.silenceT <= 0);
  assert.equal(e.silencedId, null);
});

test('player cannot cast a silenced ability', () => {
  const { c, player } = mkCombat({
    player: { atkSpeed: 0 },
    abilities: [{ id: 'a', def: { id: 'a', name: 'A', cost: 0, cooldown: 0, power: 1 } }],
  });
  player.silencedId = 'a'; player.silenceT = 5;
  const r = c.cast(player, c.abilities[0].def, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'silenced');
  player.silenceT = 0; player.silencedId = null;
  assert.equal(c.cast(player, c.abilities[0].def, 0).ok, true);
});

test('slow caps at 3 stacks of effect', () => {
  const { c, player, enemies } = mkCombat({ player: { atkSpeed: 1 } });
  const e = enemies[0];
  player.slow = 10; // slow applies to the slowed entity's own attack speed
  const startHp = e.hp;
  for (let i = 0; i < 200; i++) { c.step(); } // 10s
  const hits = Math.round((startHp - e.hp) / 10);
  // effAtkSpeed = 1 * max(0.25, 1-0.15*3) = 0.55 -> ~5-6 attacks in 10s
  assert.ok(hits >= 4 && hits <= 7, `slow cap broken, hits=${hits}`);
});

test('cast is gated by mana and cooldown', () => {
  const def = { id: 'x', name: 'X', cost: 50, cooldown: 5, power: 1 };
  const { c, player, enemies } = mkCombat({ abilities: [{ id: 'x', def }], player: { startMana: 60, atkSpeed: 0 } });
  let r = c.cast(player, def, 0);
  assert.ok(r.ok);
  r = c.cast(player, def, 0);
  assert.equal(r.reason, 'cooldown');
  player.cd = {};
  player.mana = 10;
  r = c.cast(player, def, 0);
  assert.equal(r.reason, 'mana');
});

test('cdr reduces applied cooldowns', () => {
  const def = { id: 'x', name: 'X', cost: 0, cooldown: 10, power: 0 };
  const { c, player } = mkCombat({ abilities: [{ id: 'x', def }], player: { cdr: 0.5, atkSpeed: 0 } });
  c.cast(player, def, 0);
  assert.ok(player.cd.x <= 5.001 && player.cd.x > 0);
});

test('execute swaps power below the threshold', () => {
  const def = { id: 'ex', name: 'Ex', cost: 0, cooldown: 0, power: 1.0, executePower: 3.0, executeBelow: 0.3 };
  const { c, player, enemies } = mkCombat({ abilities: [{ id: 'ex', def }], player: { atkSpeed: 0, crit: 0 } });
  const e = enemies[0];
  e.hp = 60; // 60%: normal power (~10)
  const before = e.hp;
  c.cast(player, def, 0);
  const normal = before - e.hp;
  assert.ok(normal >= 8 && normal <= 12, `normal hit should be ~10, got ${normal}`);
  e.hp = 30; // 30%: execute power (~30)
  const before2 = e.hp;
  c.cast(player, def, 0);
  const dealt = before2 - e.hp;
  assert.ok(dealt >= 25, `execute should hit ~30, got ${dealt}`);
});

test('combat ends with win when all enemies die', () => {
  const { c, enemies } = mkCombat({ enemies: [{ name: 'A', maxHp: 5, atk: 0, atkSpeed: 0 }, { name: 'B', maxHp: 5, atk: 0, atkSpeed: 0 }] });
  for (const e of enemies) e.hp = 0;
  c.checkDeath(enemies[0]);
  c.checkDeath(enemies[1]);
  assert.ok(c.done && c.win);
});

test('enemy AI casts its abilities', () => {
  const ea = { E: [{ id: 'slam', name: 'Slam', cost: 10, cooldown: 1, power: 2, ai: 1 }] };
  const { c, player } = mkCombat({ player: { atkSpeed: 0 }, enemies: [{ name: 'E', maxHp: 100, atk: 0, atkSpeed: 0, manaRegen: 100, startMana: 100 }], enemyAbilities: ea });
  for (let i = 0; i < 40; i++) c.step();
  assert.ok(player.hp < 100, 'enemy slam should have hit');
});

test('runToCompletion terminates and sets a result', () => {
  const { c } = mkCombat({ enemies: [{ name: 'E', maxHp: 30, atk: 5, atkSpeed: 1 }] });
  c.runToCompletion(null, 60);
  assert.ok(c.done);
  assert.equal(c.win, true); // player atk 10 vs 30hp, enemy 5 atk vs 100hp
});
