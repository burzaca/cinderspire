// CINDERSPIRE run flow — the roguelike climb. Pure logic, no DOM: the UI and
// the headless simulator both drive this same module.

import { makeRng } from './rng.js';
import { makeEntity, Combat } from './engine.js';
import {
  CLASSES, ABILITIES, RELICS, ENEMIES, ENEMY_ABILITIES, EVENTS, BOONS, POTIONS,
  FLOORS_PER_ACT, RARITY_WEIGHT, xpForLevel, abilityPoolFor,
} from './data.js';

export function abilityDef(entry) {
  // entry = {id, level}; upgrades: +25% power per level, -1 cost at level 3.
  const base = ABILITIES[entry.id];
  const def = { id: entry.id, ...base };
  if (entry.level >= 2 && def.power) def.power = +(def.power * (1 + 0.25 * (entry.level - 1))).toFixed(2);
  if (entry.level >= 2 && def.burn) def.burn = Math.round(def.burn * (1 + 0.3 * (entry.level - 1)));
  if (entry.level >= 2 && def.curse) def.curse = Math.round(def.curse * (1 + 0.3 * (entry.level - 1)));
  if (entry.level >= 2 && def.shield) def.shield = Math.round(def.shield * (1 + 0.3 * (entry.level - 1)));
  if (entry.level >= 2 && def.heal) def.heal = Math.round(def.heal * (1 + 0.3 * (entry.level - 1)));
  if (entry.level >= 3) def.cost = Math.max(1, def.cost - 2);
  if (entry.level >= 2 && def.cooldown) def.cooldown = Math.max(1, +(def.cooldown * (1 - 0.1 * (entry.level - 1))).toFixed(1));
  def.level = entry.level;
  return def;
}

export function computeStats(run, metaBonuses = {}) {
  const cls = CLASSES[run.cls];
  const s = { ...cls.stats };
  const add = (b) => { for (const [k, v] of Object.entries(b || {})) s[k] = (s[k] || 0) + v; };
  add(metaBonuses.stats);
  for (const rid of run.relics) add(RELICS[rid].stats);
  add(run.bonusStats);
  s.maxHp = Math.max(10, Math.round(s.maxHp));
  s.atk = Math.max(1, s.atk);
  return s;
}

export function startRun({ seed, cls, metaBonuses = {} }) {
  if (!CLASSES[cls]) throw new Error('unknown class ' + cls);
  const run = {
    seed, cls,
    floor: 1,               // global floor (1..∞); act derived
    gold: 30 + (metaBonuses.startGold || 0),
    xp: 0, level: 1,
    abilities: CLASSES[cls].start.map((id) => ({ id, level: 1 })),
    relics: [],
    potions: [...(metaBonuses.potions || [])],
    bonusStats: {},
    hpCurrent: null,        // carried HP between fights (the climb is a marathon)
    pendingBoons: null,
    doorOptions: null,
    rngState: null,
    stats: { kills: 0, bosses: 0, actsCleared: 0, floorsVisited: 0 },
    over: false, wonRun: false,
  };
  run.rng = makeRng(seed);
  run.stats.maxHpSeen = computeStats(run, metaBonuses).maxHp;
  genDoors(run, metaBonuses);
  return run;
}

export const actOf = (run) => Math.floor((run.floor - 1) / FLOORS_PER_ACT) + 1;
export const floorInAct = (run) => ((run.floor - 1) % FLOORS_PER_ACT) + 1;
export const baseActOf = (run) => ((actOf(run) - 1) % 3) + 1;   // content act (1..3)
export const loopOf = (run) => Math.floor((actOf(run) - 1) / 3); // endless loop index

// ---- doors ----------------------------------------------------------------
export function genDoors(run) {
  const rng = run.rng;
  if (floorInAct(run) === FLOORS_PER_ACT) {
    run.doorOptions = [{ type: 'boss' }];
    return;
  }
  const act = baseActOf(run);
  const n = rng.weighted([[2, 60], [3, 40]]);
  const weights = [
    ['combat', 55],
    ['elite', 8 + 3 * act],
    ['event', 13],
    ['shop', run.floor === 1 ? 0 : 10],
    ['rest', 11],
  ];
  const doors = [];
  for (let i = 0; i < n; i++) doors.push({ type: rng.weighted(weights) });
  if (!doors.some((d) => d.type === 'combat' || d.type === 'elite')) doors[0].type = 'combat';
  // avoid two identical non-combat doors when only 2 exist
  if (n === 2 && doors[0].type === doors[1].type && doors[1].type !== 'combat') {
    doors[1].type = rng.weighted([['combat', 70], ['event', 15], ['rest', 15]]);
  }
  run.doorOptions = doors;
}

// ---- encounters -------------------------------------------------------------
export function makeEncounter(run) {
  const rng = run.rng;
  const baseAct = baseActOf(run), loop = loopOf(run);
  const floorScale = 1 + 0.04 * (floorInAct(run) - 1);
  const loopHp = 1 + 0.25 * loop, loopAtk = 1 + 0.18 * loop;
  const pool = Object.values(ENEMIES).filter((e) => e.act === baseAct);
  const normals = pool.filter((e) => !e.elite && !e.boss);
  const elites = pool.filter((e) => e.elite);
  const boss = pool.find((e) => e.boss);

  let picks = [];
  const type = run._pendingDoor || 'combat';
  if (type === 'boss') picks = [boss];
  else if (type === 'elite') picks = [rng.pick(elites), ...(rng.chance(0.4) ? [rng.pick(normals)] : [])];
  else {
    const floor = floorInAct(run);
    const count = floor <= 2 ? 1 : rng.weighted([[1, 55], [2, 35], [3, Math.min(15, 3 + 4 * baseAct)]]);
    for (let i = 0; i < count; i++) picks.push(rng.pick(normals));
  }

  const enemies = picks.map((tpl) => {
    const st = { ...tpl.stats };
    st.maxHp = Math.round(st.maxHp * floorScale * loopHp);
    st.atk = Math.round(st.atk * floorScale * loopAtk);
    const e = makeEntity({ ...st, name: tpl.name, glyph: tpl.glyph }, 'enemy');
    e.tpl = tpl;
    return e;
  });
  const enemyAbilities = {};
  for (const tpl of picks) {
    if (tpl.abilities) enemyAbilities[tpl.name] = tpl.abilities.map((id) => ({ id, ...ENEMY_ABILITIES[id] }));
  }
  return { enemies, enemyAbilities };
}

export function buildCombat(run, encounter, metaBonuses = {}) {
  const stats = computeStats(run, metaBonuses);
  const player = makeEntity({ ...stats, name: CLASSES[run.cls].name, glyph: CLASSES[run.cls].glyph }, 'player');
  if (run.hpCurrent != null) player.hp = Math.max(1, Math.min(run.hpCurrent, player.maxHp));
  const abilities = run.abilities.map((entry) => ({ id: entry.id, def: abilityDef(entry) }));
  return new Combat({
    rng: run.rng,
    player,
    enemies: encounter.enemies,
    abilities,
    enemyAbilities: encounter.enemyAbilities,
  });
}

// ---- victory / spoils --------------------------------------------------------
export function rollSpoils(run, metaBonuses = {}) {
  const rng = run.rng;
  const luck = computeStats(run, metaBonuses).luck || 0;
  const offers = [];
  for (let i = 0; i < 3; i++) {
    const roll = rng.weighted([['ability', 55], ['gold', 25], ['potion', 10 + luck * 0.5], ['relic', 10 + luck]]);
    if (roll === 'ability') {
      const rarity = rng.weighted([
        ['common', Math.max(10, RARITY_WEIGHT.common - luck * 4)],
        ['uncommon', RARITY_WEIGHT.uncommon + luck],
        ['rare', RARITY_WEIGHT.rare + luck * 2],
      ]);
      const owned = new Set(run.abilities.map((a) => a.id));
      let pool = abilityPoolFor(run.cls, rarity).filter(([id]) => !owned.has(id));
      if (!pool.length) pool = abilityPoolFor(run.cls, null).filter(([id]) => !owned.has(id));
      if (!pool.length) { offers.push(goldOffer(run)); continue; }
      const [id] = rng.pick(pool);
      offers.push({ kind: 'ability', id });
    } else if (roll === 'relic') {
      const owned = new Set(run.relics);
      let pool = Object.keys(RELICS).filter((r) => !owned.has(r));
      if (!pool.length) { offers.push(goldOffer(run)); continue; }
      offers.push({ kind: 'relic', id: rng.pick(pool) });
    } else if (roll === 'potion') {
      offers.push({ kind: 'potion', id: rng.pick(Object.keys(POTIONS)) });
    } else {
      offers.push(goldOffer(run));
    }
  }
  return offers;
}
const goldOffer = (run) => ({ kind: 'gold', amount: 40 + 15 * baseActOf(run) + run.rng.int(0, 25) });

export function applyVictory(run, combat, metaBonuses = {}) {
  let xp = 0, gold = 0;
  for (const e of combat.enemies) {
    const tpl = e.tpl;
    xp += tpl.xp;
    gold += tpl.gold;
    run.stats.kills++;
    if (tpl.boss) run.stats.bosses++;
  }
  const stats = computeStats(run, metaBonuses);
  gold = Math.round(gold * (1 + (stats.goldBonus || 0)));
  run.gold += gold;
  run.xp += xp;
  // scavenge: small recovery after each victory keeps the marathon survivable
  const rec = Math.round(stats.maxHp * 0.08);
  run.hpCurrent = Math.min(stats.maxHp, combat.player.hp + rec);
  run.levelUps = 0;
  while (run.xp >= xpForLevel(run.level)) {
    run.xp -= xpForLevel(run.level);
    run.level++;
    run.levelUps++;
  }
  if (run.levelUps > 0) run.pendingBoons = pickBoons(run, run.levelUps);
  run.stats.maxHpSeen = Math.max(run.stats.maxHpSeen || 0, stats.maxHp);
  const spoils = rollSpoils(run, metaBonuses);
  return { xp, gold, spoils };
}

function pickBoons(run, n) {
  const rng = run.rng;
  const pool = rng.shuffle(Object.values(BOONS));
  return pool.slice(0, 3);
}

export function takeSpoil(run, offer) {
  if (!offer) return;
  if (offer.kind === 'gold') run.gold += offer.amount;
  else if (offer.kind === 'ability') run.abilities.push({ id: offer.id, level: 1 });
  else if (offer.kind === 'relic') run.relics.push(offer.id);
  else if (offer.kind === 'potion') run.potions.push(offer.id);
}

export function chooseBoon(run, boon) {
  for (const [k, v] of Object.entries(boon.stat || {})) run.bonusStats[k] = (run.bonusStats[k] || 0) + v;
  const stats = computeStats(run);
  let cur = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
  if (boon.heal) cur += boon.heal;
  if (boon.healPct) cur += Math.round(stats.maxHp * boon.healPct);
  run.hpCurrent = Math.min(stats.maxHp, Math.round(cur));
  run.pendingBoons = (run.pendingBoons || []).filter((b) => b.id !== boon.id);
  if (run.pendingBoons.length === 0) run.pendingBoons = null;
}

// ---- shop --------------------------------------------------------------------
export function rollShop(run, metaBonuses = {}) {
  const rng = run.rng;
  const luck = computeStats(run, metaBonuses).luck || 0;
  const priceMul = (1 + 0.12 * (baseActOf(run) - 1)) * Math.max(0.6, 1 - luck * 0.012);
  const price = (rarity) => Math.round(({ common: 45, uncommon: 75, rare: 120 }[rarity]) * priceMul / 5) * 5;
  const items = [];
  const owned = new Set(run.abilities.map((a) => a.id));
  const pool = rng.shuffle(abilityPoolFor(run.cls, null).filter(([id]) => !owned.has(id)));
  for (const [id, def] of pool.slice(0, 3)) items.push({ kind: 'ability', id, price: price(def.rarity) });
  const relicPool = rng.shuffle(Object.keys(RELICS).filter((r) => !run.relics.includes(r)));
  for (const id of relicPool.slice(0, 2)) items.push({ kind: 'relic', id, price: Math.round((70 + rng.int(0, 60)) * priceMul / 5) * 5 });
  items.push({ kind: 'potion', id: rng.pick(Object.keys(POTIONS)), price: Math.round(28 * priceMul / 5) * 5 });
  items.push({ kind: 'heal', price: Math.round(35 * priceMul / 5) * 5 });
  run.shop = items;
  return items;
}

export function buyItem(run, item) {
  if (run.gold < item.price) return { ok: false, reason: 'gold' };
  if (item.kind === 'ability') {
    if (run.abilities.some((a) => a.id === item.id)) return { ok: false, reason: 'owned' };
    run.abilities.push({ id: item.id, level: 1 });
  } else if (item.kind === 'relic') {
    if (run.relics.includes(item.id)) return { ok: false, reason: 'owned' };
    run.relics.push(item.id);
  } else if (item.kind === 'potion') {
    if (run.potions.length >= 4) return { ok: false, reason: 'potion cap' };
    run.potions.push(item.id);
  } else if (item.kind === 'heal') {
    const stats = computeStats(run);
    const cur = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
    run.hpCurrent = Math.min(stats.maxHp, cur + Math.round(stats.maxHp * 0.5));
  }
  run.gold -= item.price;
  return { ok: true };
}

export function upgradeAbility(run, id, cost) {
  const entry = run.abilities.find((a) => a.id === id);
  if (!entry || entry.level >= 3) return { ok: false };
  if (run.gold < cost) return { ok: false, reason: 'gold' };
  run.gold -= cost;
  entry.level++;
  return { ok: true };
}
export const upgradeCost = (entry) => ({ 2: 60, 3: 140 }[entry.level + 1] || 0);

// ---- events -------------------------------------------------------------------
export function rollEvent(run) {
  const ev = run.rng.pick(EVENTS);
  run.event = ev;
  return ev;
}

export function resolveEvent(run, choice, metaBonuses = {}) {
  const o = choice.outcome || {};
  const res = { notes: [] };
  if (o.gold) { run.gold += o.gold; res.notes.push(`+${o.gold} gold`); }
  if (o.hp) {
    const stats = computeStats(run, metaBonuses);
    const cur = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
    const next = Math.max(1, Math.min(stats.maxHp, cur + o.hp));
    res.notes.push(`${next - cur >= 0 ? '+' : ''}${next - cur} HP`);
    run.hpCurrent = next;
  }
  if (o.stat) {
    for (const [k, v] of Object.entries(o.stat)) run.bonusStats[k] = (run.bonusStats[k] || 0) + v;
    res.notes.push('changed');
  }
  if (o.buff) run.bonusStats.buffStart = (run.bonusStats.buffStart || 0) + o.buff;
  if (o.gamble) {
    if (run.gold >= o.gamble.stake && run.rng.chance(o.gamble.p)) {
      run.gold += o.gamble.win; res.notes.push(`won ${o.gamble.win} gold`);
    } else {
      run.gold = Math.max(0, run.gold - o.gamble.stake); res.notes.push(`lost ${o.gamble.stake} gold`);
    }
  }
  if (o.ability) {
    const owned = new Set(run.abilities.map((a) => a.id));
    const pool = abilityPoolFor(run.cls, null).filter(([id]) => !owned.has(id));
    if (pool.length) { const [id] = run.rng.pick(pool); run.abilities.push({ id, level: 1 }); res.notes.push(`learned ${ABILITIES[id].name}`); }
  }
  if (o.relic) {
    const pool = Object.keys(RELICS).filter((r) => !run.relics.includes(r));
    if (pool.length) { const id = run.rng.pick(pool); run.relics.push(id); res.notes.push(`found ${RELICS[id].name}`); }
  }
  if (o.upgradeRandom) {
    const cands = run.abilities.filter((a) => a.level < 3);
    if (cands.length) { const a = run.rng.pick(cands); a.level++; res.notes.push(`${ABILITIES[a.id].name} upgraded`); }
  }
  if (o.upgradeChosen) {
    if (run.gold >= (o.cost || 0)) { run.gold -= o.cost; run._freeUpgrade = true; res.notes.push('choose an ability to upgrade'); }
    else res.notes.push('not enough gold');
  }
  run.event = null;
  return res;
}

// ---- rest ---------------------------------------------------------------------
export function restOptions(run) {
  return [
    { id: 'sleep', label: 'Sleep', desc: 'Heal 35% of max HP' },
    { id: 'train', label: 'Train', desc: 'Upgrade a random ability' },
  ];
}
export function applyRest(run, id) {
  const stats = computeStats(run);
  if (id === 'sleep') {
    const cur = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
    run.hpCurrent = Math.min(stats.maxHp, cur + Math.round(stats.maxHp * 0.35));
    return { note: 'Rested. You feel rekindled.' };
  }
  const cands = run.abilities.filter((a) => a.level < 3);
  if (!cands.length) return { note: 'Nothing left to sharpen.' };
  const a = run.rng.pick(cands);
  a.level++;
  return { note: `${ABILITIES[a.id].name} honed to level ${a.level}.` };
}

// ---- door resolution -------------------------------------------------------------
export function enterDoor(run, door) {
  run._pendingDoor = door.type;
  run.stats.floorsVisited++;
  if (door.type === 'combat' || door.type === 'elite' || door.type === 'boss') {
    if (door.type === 'boss') run.hpCurrent = null; // camp at the gate: bosses are set-piece fights
    return { type: door.type, encounter: makeEncounter(run) };
  }
  if (door.type === 'shop') return { type: 'shop', items: rollShop(run) };
  if (door.type === 'event') return { type: 'event', event: rollEvent(run) };
  if (door.type === 'rest') return { type: 'rest', options: restOptions(run) };
  throw new Error('bad door ' + door.type);
}

export function finishFloor(run) {
  if (floorInAct(run) === FLOORS_PER_ACT) run.stats.actsCleared++;
  run.floor++;
  run.doorOptions = null;
  genDoors(run);
}

// ---- death / embers ---------------------------------------------------------------
export function runSummary(run) {
  const floors = run.floor - 1;
  const raw = floors * 2 + run.stats.bosses * 30 + Math.floor(run.stats.kills * 0.5);
  return {
    seed: run.seed, cls: run.cls,
    floor: run.floor, act: actOf(run),
    kills: run.stats.kills, bosses: run.stats.bosses,
    actsCleared: run.stats.actsCleared,
    embersRaw: Math.max(0, Math.round(raw)),
    abilities: run.abilities.length, relics: run.relics.length,
  };
}

// ---- save / resume ----------------------------------------------------------------
export function serializeRun(run) {
  return {
    seed: run.seed, cls: run.cls, floor: run.floor, gold: run.gold,
    xp: run.xp, level: run.level, abilities: run.abilities, relics: run.relics,
    potions: run.potions, bonusStats: run.bonusStats, hpCurrent: run.hpCurrent,
    pendingBoons: run.pendingBoons, doorOptions: run.doorOptions,
    rngState: run.rng.getState(), stats: run.stats, over: run.over,
  };
}

export function deserializeRun(data) {
  const run = {
    ...data,
    rng: makeRng(data.seed),
  };
  run.rng.setState(data.rngState);
  return run;
}
