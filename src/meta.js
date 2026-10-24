// CINDERSPIRE meta progression — the Forge. Embers are earned from runs AND
// trickle in while you are away (idle income). Upgrades are permanent within a
// "forging"; Reforge resets them for Cinders, a permanent ember multiplier.

import { FORGE, CLASSES, ACHIEVEMENTS } from './data.js';

export const SAVE_VERSION = 1;
export const OFFLINE_CAP_S = 8 * 3600;

export function defaultMeta() {
  return {
    version: SAVE_VERSION,
    embers: 0,
    cinders: 0,
    totalForgeSpent: 0,
    forge: {},                 // upgradeId -> level
    unlocked: { emberwright: true },
    achievements: {},          // id -> true (reward paid)
    stats: { runs: 0, kills: 0, bestFloor: 0, bossKills: 0, actsCleared: 0, reforges: 0 },
    lastSeen: Date.now(),
    settings: {},
  };
}

export const forgeLevel = (meta, id) => meta.forge[id] || 0;
export function forgeCost(up, level) {
  return Math.round(up.base * Math.pow(up.growth, level));
}

export function buyForge(meta, id) {
  const up = FORGE.find((u) => u.id === id);
  if (!up) return { ok: false, reason: 'unknown' };
  const lvl = forgeLevel(meta, id);
  if (lvl >= up.max) return { ok: false, reason: 'maxed' };
  const cost = forgeCost(up, lvl);
  if (meta.embers < cost) return { ok: false, reason: 'embers' };
  meta.embers -= cost;
  meta.totalForgeSpent += cost;
  meta.forge[id] = lvl + 1;
  return { ok: true };
}

export function unlockClass(meta, cls) {
  const clsDef = CLASSES[cls];
  if (!clsDef || meta.unlocked[cls]) return { ok: false, reason: 'owned' };
  if (meta.embers < clsDef.unlockCost) return { ok: false, reason: 'embers' };
  meta.embers -= clsDef.unlockCost;
  meta.unlocked[cls] = true;
  return { ok: true };
}

// Everything a run receives from the Forge before it starts.
export function metaBonuses(meta) {
  const b = { stats: {}, startGold: 0, potions: [], emberBonus: 0, idleRate: 0 };
  for (const up of FORGE) {
    const lvl = forgeLevel(meta, up.id);
    if (!lvl) continue;
    if (up.stat) for (const [k, v] of Object.entries(up.stat)) b.stats[k] = (b.stats[k] || 0) + v * lvl;
    if (up.gold) b.startGold += up.gold * lvl;
    if (up.potion) for (let i = 0; i < up.potion * lvl; i++) b.potions.push(['heal_potion', 'ember_flask', 'mana_tonic', 'rush_oil'][i % 4]);
    if (up.emberBonus) b.emberBonus += up.emberBonus * lvl;
    if (up.idle) b.idleRate += up.idle * lvl;
  }
  return b;
}

export const cinderMult = (meta) => 1 + 0.3 * (meta.cinders || 0);

export function idleRate(meta) {
  const b = metaBonuses(meta);
  return b.idleRate * (1 + (meta.stats.bestFloor || 0) * 0.02) * cinderMult(meta);
}

export function pendingCinders(meta) {
  return Math.max(0, Math.floor(Math.sqrt((meta.totalForgeSpent || 0) / 400)) - (meta.cinders || 0));
}

export function reforge(meta) {
  const gain = pendingCinders(meta);
  if (gain <= 0) return { ok: false, reason: 'nothing' };
  meta.cinders += gain;
  meta.stats.reforges = (meta.stats.reforges || 0) + 1;
  meta.forge = {};
  return { ok: true, gained: gain };
}

// Apply a finished run to the meta. Returns {embers, newAchievements}.
export function applyRunResult(meta, summary, bonuses) {
  const gain = Math.round(summary.embersRaw * (1 + (bonuses?.emberBonus || 0)) * cinderMult(meta));
  meta.embers += gain;
  meta.stats.runs++;
  meta.stats.kills += summary.kills;
  meta.stats.bestFloor = Math.max(meta.stats.bestFloor || 0, summary.floor);
  meta.stats.bossKills += summary.bosses;
  meta.stats.actsCleared = Math.max(meta.stats.actsCleared || 0, summary.actsCleared);
  const newAch = [];
  for (const a of ACHIEVEMENTS) {
    if (!meta.achievements[a.id] && a.check(meta, summary)) {
      meta.achievements[a.id] = true;
      meta.embers += a.reward;
      newAch.push(a);
    }
  }
  return { embers: gain, newAchievements: newAch };
}

// Offline/idle income. Called on load; also usable live.
export function collectIdle(meta, now = Date.now()) {
  const elapsed = Math.max(0, Math.min(OFFLINE_CAP_S, (now - (meta.lastSeen || now)) / 1000));
  const rate = idleRate(meta);
  const gain = Math.floor(rate * elapsed);
  meta.lastSeen = now;
  if (gain > 0) meta.embers += gain;
  return { gain, seconds: Math.round(elapsed), rate };
}
