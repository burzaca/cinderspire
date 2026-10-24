import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultMeta, buyForge, forgeCost, forgeLevel, metaBonuses, unlockClass,
  pendingCinders, reforge, applyRunResult, collectIdle, idleRate, cinderMult, OFFLINE_CAP_S,
} from '../src/meta.js';
import { FORGE } from '../src/data.js';

test('forgeCost follows the growth curve', () => {
  const up = FORGE.find((u) => u.id === 'heart_coal');
  assert.equal(forgeCost(up, 0), up.base);
  assert.equal(forgeCost(up, 2), Math.round(up.base * up.growth ** 2));
});

test('buyForge refuses when short on embers and at max level', () => {
  const m = defaultMeta();
  const up = FORGE.find((u) => u.id === 'heart_coal');
  assert.equal(buyForge(m, up.id).reason, 'embers');
  m.embers = 1e9;
  for (let i = 0; i < up.max; i++) assert.ok(buyForge(m, up.id).ok);
  assert.equal(buyForge(m, up.id).reason, 'maxed');
  assert.equal(forgeLevel(m, up.id), up.max);
});

test('metaBonuses aggregates stats, gold, potions and idle rate', () => {
  const m = defaultMeta();
  m.embers = 1e9;
  buyForge(m, 'heart_coal'); buyForge(m, 'heart_coal');
  buyForge(m, 'purse');   // Kindling Purse: +20 starting gold
  buyForge(m, 'pouch');   // Field Pouch: +1 starting potion
  buyForge(m, 'forge_heart');
  const b = metaBonuses(m);
  assert.equal(b.stats.maxHp, 16);
  assert.equal(b.startGold, 20);
  assert.equal(b.potions.length, 1);
  assert.ok(b.idleRate > 0);
});

test('unlockClass charges and unlocks once', () => {
  const m = defaultMeta();
  m.embers = 200;
  assert.ok(unlockClass(m, 'ironsoul').ok);
  assert.equal(unlockClass(m, 'ironsoul').reason, 'owned');
  m.embers = 0;
  assert.equal(unlockClass(m, 'gravetongue').reason, 'embers');
});

test('pendingCinders follows floor(sqrt(spent/400)) - cinders', () => {
  const m = defaultMeta();
  m.totalForgeSpent = 1600;
  assert.equal(pendingCinders(m), 2);
  m.cinders = 1;
  assert.equal(pendingCinders(m), 1);
});

test('reforge grants cinders and resets forge levels', () => {
  const m = defaultMeta();
  m.embers = 1e9;
  buyForge(m, 'heart_coal');
  m.totalForgeSpent = 1600;
  const r = reforge(m);
  assert.ok(r.ok && r.gained === 2);
  assert.equal(m.cinders, 2);
  assert.deepEqual(m.forge, {});
  assert.equal(cinderMult(m), 1.6);
});

test('applyRunResult pays each achievement exactly once', () => {
  const m = defaultMeta();
  const summary = { floor: 2, act: 1, kills: 5, bosses: 0, actsCleared: 0, embersRaw: 20 };
  const r1 = applyRunResult(m, summary, {});
  assert.ok(r1.newAchievements.some((a) => a.id === 'first_blood'));
  const r2 = applyRunResult(m, summary, {});
  assert.ok(!r2.newAchievements.some((a) => a.id === 'first_blood'));
  assert.ok(m.embers > 0);
});

test('applyRunResult updates best floor and totals', () => {
  const m = defaultMeta();
  applyRunResult(m, { floor: 12, act: 2, kills: 30, bosses: 1, actsCleared: 1, embersRaw: 50 }, {});
  assert.equal(m.stats.bestFloor, 12);
  assert.equal(m.stats.bossKills, 1);
  applyRunResult(m, { floor: 5, act: 1, kills: 1, bosses: 0, actsCleared: 0, embersRaw: 5 }, {});
  assert.equal(m.stats.bestFloor, 12, 'best floor must not regress');
});

test('collectIdle credits offline time but caps at 8h', () => {
  const m = defaultMeta();
  m.embers = 1e9;
  for (let i = 0; i < 10; i++) buyForge(m, 'forge_heart');
  m.stats.bestFloor = 10;
  const rate = idleRate(m);
  assert.ok(rate > 0);
  const now = Date.now();
  m.lastSeen = now - 10 * 3600 * 1000; // 10h ago
  const before = m.embers;
  const r = collectIdle(m, now);
  assert.equal(r.seconds, OFFLINE_CAP_S);
  assert.equal(m.embers - before, Math.floor(rate * OFFLINE_CAP_S));
});

test('collectIdle with no elapsed time credits nothing', () => {
  const m = defaultMeta();
  m.embers = 1e9;
  for (let i = 0; i < 10; i++) buyForge(m, 'forge_heart');
  const now = Date.now();
  m.lastSeen = now;
  const before = m.embers;
  const r = collectIdle(m, now);
  assert.equal(r.gain, 0);
  assert.equal(m.embers, before);
});
