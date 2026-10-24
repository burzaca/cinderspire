import { computeStats } from '../src/run.js';
import { ABILITIES } from '../src/data.js';

// Human-ish spoils policy: score each offered ability, take the best;
// take gold only when the offers are junk.
export function abilityScore(id, run, stats) {
  const a = ABILITIES[id];
  if (!a) return 0;
  const hpPct = (run.hpCurrent == null ? stats.maxHp : run.hpCurrent) / stats.maxHp;
  let s = 0;
  if (a.power) s += a.power * (a.hits || 1) * (a.aoe ? 1.35 : 1);
  if (a.executePower) s += a.executePower * 0.5;
  if (a.burn) s += a.burn * 0.5;
  if (a.burnAmp) s += a.burnAmp * 15;
  if (a.curse) s += a.curse * 0.5;
  if (a.heal) s += a.heal * (hpPct < 0.6 ? 0.9 : 0.35);
  if (a.shield) s += a.shield * 0.45;
  if (a.thornsGain) s += a.thornsGain * 1.2;
  if (a.slow) s += a.slow * 1.5;
  if (a.weaken) s += a.weaken * 1.8;
  if (a.buff) s += a.buff * 2.2;
  if (a.mana) s += a.mana * 0.12;
  if (a.cdr) s += a.cdr * 40;
  if (a.selfDamage) s -= a.selfDamage * 0.25;
  // cost efficiency: cheap spammable abilities punch up
  const eff = a.cost > 0 ? 1 - (a.cost - 20) / 120 : 1.15;
  s *= Math.max(0.5, Math.min(1.3, eff));
  s *= 1 - Math.min(0.3, (a.cooldown || 0) / 60);
  // synergy: more damage abilities if already damage-heavy
  const dmgCount = run.abilities.filter((x) => ABILITIES[x] && ABILITIES[x].power).length;
  if (a.power) s *= 1 + dmgCount * 0.08;
  return s;
}

export function pickSpoil(run, spoils, bonuses) {
  const stats = computeStats(run, bonuses);
  let best = null, bestScore = -1;
  for (const sp of spoils) {
    if (sp.kind === 'ability') {
      const sc = abilityScore(sp.id, run, stats);
      if (sc > bestScore) { bestScore = sc; best = sp; }
    }
  }
  const gold = spoils.find((s) => s.kind === 'gold');
  const potion = spoils.find((s) => s.kind === 'potion');
  const hpPct = (run.hpCurrent == null ? stats.maxHp : run.hpCurrent) / stats.maxHp;
  if (best && bestScore >= 1.6) return best;
  if (potion && hpPct < 0.7) return potion;
  if (best && bestScore >= 0.8) return best;
  return gold || best || spoils[0];
}

// Door policy shared by the simulator and debug tools: a "decent player" proxy.
export function pickDoor(run, bonuses) {
  const stats = computeStats(run, bonuses);
  const hp = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
  const doors = run.doorOptions;
  if (hp < stats.maxHp * 0.65) {
    const rest = doors.find((d) => d.type === 'rest');
    if (rest) return rest;
  }
  const shop = doors.find((d) => d.type === 'shop');
  if (shop && run.gold > 150) return shop;
  const fight = doors.find((d) => d.type === 'combat') || doors.find((d) => d.type === 'elite') || doors[0];
  return fight;
}
