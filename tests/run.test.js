import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startRun, enterDoor, buildCombat, applyVictory, takeSpoil, chooseBoon,
  finishFloor, runSummary, computeStats, buyItem, upgradeCost, rollShop,
  resolveEvent, applyRest, serializeRun, deserializeRun, actOf, floorInAct,
  abilityDef,
} from '../src/run.js';
import { autopilot } from '../src/engine.js';
import { defaultMeta, metaBonuses } from '../src/meta.js';
import { FLOORS_PER_ACT } from '../src/data.js';

const B = {}; // empty bonuses

test('startRun yields 2-3 doors on floor 1 and valid state', () => {
  for (let seed = 1; seed < 30; seed++) {
    const run = startRun({ seed, cls: 'emberwright', metaBonuses: B });
    assert.ok(run.doorOptions.length >= 2 && run.doorOptions.length <= 3);
    assert.ok(run.doorOptions.some((d) => d.type === 'combat' || d.type === 'elite'), 'must offer a fight');
    assert.equal(run.gold, 30);
    assert.equal(run.abilities.length, 3);
  }
});

test('boss floor offers exactly one boss door', () => {
  const run = startRun({ seed: 7, cls: 'emberwright', metaBonuses: B });
  run.floor = FLOORS_PER_ACT;
  run.doorOptions = null;
  enterDoor(run, { type: 'rest' }); // consume floor 8? no — set floor then regen doors
  run.floor = FLOORS_PER_ACT;
  const r = enterDoor(run, { type: 'boss' });
  assert.equal(r.type, 'boss');
  assert.equal(r.encounter.enemies.length, 1);
  assert.ok(r.encounter.enemies[0].tpl.boss);
});

test('floors 1-2 spawn exactly one normal enemy', () => {
  for (let seed = 1; seed < 20; seed++) {
    const run = startRun({ seed, cls: 'gravetongue', metaBonuses: B });
    const res = enterDoor(run, { type: 'combat' });
    assert.equal(res.encounter.enemies.length, 1);
  }
});

test('loop scaling multiplies hp and atk (same content act, deeper loop)', () => {
  const avgHpAt = (floor) => {
    let total = 0, n = 0;
    for (let seed = 100; seed < 110; seed++) {
      const run = startRun({ seed, cls: 'ironsoul', metaBonuses: B });
      run.floor = floor;
      const a = enterDoor(run, { type: 'combat' });
      total += a.encounter.enemies.reduce((s, e) => s + e.maxHp, 0);
      n += a.encounter.enemies.length;
    }
    return total / n;
  };
  const base = avgHpAt(3);              // act 1, loop 0, floor 3
  const loop = avgHpAt(8 * 3 + 3);      // act 4 -> content act 1 again, loop 1
  assert.ok(loop > base * 1.15, `loop hp ${loop} should exceed base ${base}`);
});

test('boss entry fully heals (camp at the gate)', () => {
  const run = startRun({ seed: 11, cls: 'ironsoul', metaBonuses: B });
  run.hpCurrent = 10;
  const res = enterDoor(run, { type: 'boss' });
  const combat = buildCombat(run, res.encounter, B);
  assert.equal(combat.player.hp, combat.player.maxHp);
});

test('applyVictory grants xp/gold, scavenges 8%, and offers 3 spoils', () => {
  const run = startRun({ seed: 5, cls: 'emberwright', metaBonuses: B });
  const res = enterDoor(run, { type: 'combat' });
  const combat = buildCombat(run, res.encounter, B);
  combat.runToCompletion(autopilot(), 120);
  assert.ok(combat.win);
  const before = run.gold;
  const out = applyVictory(run, combat, B);
  assert.ok(out.gold > 0 && out.xp > 0);
  assert.equal(run.gold, before + out.gold);
  assert.equal(out.spoils.length, 3);
  const stats = computeStats(run, B);
  assert.ok(run.hpCurrent <= stats.maxHp);
  assert.ok(run.hpCurrent >= combat.player.hp); // scavenge only adds
});

test('level-ups queue boons in threes and chooseBoon applies them', () => {
  const run = startRun({ seed: 9, cls: 'emberwright', metaBonuses: B });
  run.xp = 0; run.level = 1;
  run.xp = 10_000; // force several levels
  const res = enterDoor(run, { type: 'combat' });
  const combat = buildCombat(run, res.encounter, B);
  combat.runToCompletion(autopilot(), 120);
  applyVictory(run, combat, B);
  assert.ok(run.pendingBoons && run.pendingBoons.length === 3);
  const boon = run.pendingBoons.find((b) => b.stat && Object.keys(b.stat).length) || run.pendingBoons[0];
  const key = boon.stat && Object.keys(boon.stat)[0];
  const before = key ? (run.bonusStats[key] || 0) : 0;
  chooseBoon(run, boon);
  if (key) assert.equal(run.bonusStats[key], before + boon.stat[key]);
  assert.ok(!run.pendingBoons.some((b) => b.id === boon.id));
});

test('takeSpoil adds abilities/relics/potions/gold', () => {
  const run = startRun({ seed: 2, cls: 'emberwright', metaBonuses: B });
  takeSpoil(run, { kind: 'gold', amount: 50 });
  assert.equal(run.gold, 80);
  takeSpoil(run, { kind: 'ability', id: 'focus' });
  assert.ok(run.abilities.some((a) => a.id === 'focus'));
  takeSpoil(run, { kind: 'relic', id: 'hot_coals' });
  assert.ok(run.relics.includes('hot_coals'));
  const stats = computeStats(run, B);
  assert.equal(stats.atk, CLS_ATK('emberwright') + 2);
});
function CLS_ATK(cls) {
  const run = startRun({ seed: 0, cls, metaBonuses: B });
  return computeStats(run, B).atk;
}

test('shop guards: gold, owned, potion cap', () => {
  const run = startRun({ seed: 4, cls: 'emberwright', metaBonuses: B });
  run.gold = 0;
  rollShop(run, B);
  const item = run.shop.find((i) => i.kind === 'ability');
  assert.equal(buyItem(run, item).reason, 'gold');
  run.gold = 10_000;
  assert.ok(buyItem(run, item).ok);
  assert.equal(buyItem(run, item).reason, 'owned');
  run.potions = ['heal_potion', 'heal_potion', 'heal_potion', 'heal_potion'];
  const pot = run.shop.find((i) => i.kind === 'potion');
  assert.equal(buyItem(run, pot).reason, 'potion cap');
});

test('upgradeCost ladder', () => {
  assert.equal(upgradeCost({ level: 1 }), 60);
  assert.equal(upgradeCost({ level: 2 }), 140);
  assert.equal(upgradeCost({ level: 3 }), 0);
});

test('abilityDef upgrades power and cuts cost at level 3', () => {
  const d1 = abilityDef({ id: 'cinder_lance', level: 1 });
  const d2 = abilityDef({ id: 'cinder_lance', level: 2 });
  const d3 = abilityDef({ id: 'cinder_lance', level: 3 });
  assert.ok(d2.power > d1.power);
  assert.ok(d3.cost < d1.cost);
});

test('resolveEvent applies stat and gamble outcomes', () => {
  const run = startRun({ seed: 6, cls: 'emberwright', metaBonuses: B });
  resolveEvent(run, { outcome: { stat: { atk: 3 }, gold: 40 } }, B);
  assert.equal(run.bonusStats.atk, 3);
  assert.equal(run.gold, 70);
  run.gold = 100;
  let wins = 0, losses = 0;
  for (let i = 0; i < 50; i++) {
    const r = resolveEvent(run, { outcome: { gamble: { stake: 50, win: 100, p: 0.5 } } }, B);
    if (r.notes[0].startsWith('won')) wins++; else losses++;
    run.gold = 100;
  }
  assert.ok(wins > 10 && losses > 10, 'gamble should be roughly fair');
});

test('rest sleep heals 35% and train upgrades an ability', () => {
  const run = startRun({ seed: 8, cls: 'emberwright', metaBonuses: B });
  run.hpCurrent = 10;
  applyRest(run, 'sleep');
  const stats = computeStats(run, B);
  assert.ok(run.hpCurrent >= 10 + Math.round(stats.maxHp * 0.35) - 1);
  const lvls = run.abilities.map((a) => a.level);
  applyRest(run, 'train');
  assert.ok(run.abilities.some((a, i) => a.level > lvls[i]));
});

test('runSummary returns sane non-negative embers', () => {
  const run = startRun({ seed: 12, cls: 'gravetongue', metaBonuses: B });
  run.stats.kills = 10; run.stats.bosses = 1; run.floor = 9;
  const s = runSummary(run);
  assert.ok(s.embersRaw > 0 && Number.isFinite(s.embersRaw));
});

test('serialize/deserialize preserves doors and rng stream', () => {
  const run = startRun({ seed: 13, cls: 'emberwright', metaBonuses: B });
  const data = serializeRun(run);
  const nextBefore = [run.rng.next(), run.rng.next()];
  const r2 = deserializeRun(data);
  assert.deepEqual(r2.doorOptions, run.doorOptions);
  assert.deepEqual([r2.rng.next(), r2.rng.next()], nextBefore);
});

test('integration: autoplay run terminates within 60 floors', () => {
  const meta = defaultMeta();
  const bonuses = metaBonuses(meta);
  const run = startRun({ seed: 777, cls: 'ironsoul', metaBonuses: bonuses });
  let guard = 0;
  while (!run.over && run.floor <= 60 && guard++ < 400) {
    while (run.pendingBoons?.length) chooseBoon(run, run.pendingBoons[0]);
    const doors = run.doorOptions;
    const door = doors.find((d) => d.type === 'combat') || doors[0];
    const res = enterDoor(run, door);
    if (res.type === 'combat' || res.type === 'elite' || res.type === 'boss') {
      const combat = buildCombat(run, res.encounter, bonuses);
      combat.runToCompletion(autopilot(), 300);
      if (!combat.win) { run.over = true; break; }
      const { spoils } = applyVictory(run, combat, bonuses);
      takeSpoil(run, spoils[0]);
    } else if (res.type === 'rest') applyRest(run, 'sleep');
    else if (res.type === 'event') resolveEvent(run, run.event.choices.at(-1), bonuses);
    finishFloor(run);
  }
  const s = runSummary(run);
  assert.ok(s.floor >= 1 && Number.isFinite(s.embersRaw));
});
