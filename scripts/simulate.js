// Headless balance simulator: plays complete runs with the autopilot policy
// and reports real numbers. Run: node scripts/simulate.js [runsPerClass]
import {
  startRun, enterDoor, buildCombat, applyVictory, takeSpoil, chooseBoon,
  finishFloor, runSummary, computeStats, resolveEvent, applyRest, buyItem,
} from '../src/run.js';
import { autopilot } from '../src/engine.js';
import { defaultMeta, metaBonuses, buyForge } from '../src/meta.js';
import { CLASSES, FORGE } from '../src/data.js';
import { pickDoor, pickSpoil, abilityScore } from './sim_helpers.js';

const RUNS = parseInt(process.argv[2] || '40', 10);
const TIER = parseInt(process.argv[3] || '0', 10); // 0=fresh player, 1=seasoned (forge spread), 2=engrinded (+reforges)

function buildMeta(tier) {
  const meta = defaultMeta();
  if (tier >= 1) {
    const spread = { heart_coal: 3, bellows_up: 2, deep_lungs: 2, slag_hide: 2, purse: 2, quickstep_meta: 1 };
    for (const [id, lvl] of Object.entries(spread)) {
      for (let i = 0; i < lvl; i++) {
        const up = FORGE.find((u) => u.id === id);
        meta.embers += 10000; // grant budget; cost accounting still applies
        buyForge(meta, id);
      }
    }
    meta.unlocked.ironsoul = meta.unlocked.gravetongue = true;
  }
  if (tier >= 2) { meta.cinders = 3; meta.embers = 0; }
  return meta;
}

function playRun(seed, cls, meta) {
  const bonuses = metaBonuses(meta);
  const run = startRun({ seed, cls, metaBonuses: bonuses });
  let guard = 0;
  while (!run.over && run.floor <= 60 && guard++ < 500) {
    while (run.pendingBoons && run.pendingBoons.length) {
      const boon = run.pendingBoons[0];
      chooseBoon(run, boon);
    }
    const door = pickDoor(run, bonuses);
    const res = enterDoor(run, door);
    if (res.type === 'combat' || res.type === 'elite' || res.type === 'boss') {
      const combat = buildCombat(run, res.encounter, bonuses);
      combat.runToCompletion(autopilot(), 600);
      if (!combat.win) { run.over = true; break; }
      const { spoils } = applyVictory(run, combat, bonuses);
      takeSpoil(run, pickSpoil(run, spoils, bonuses));
    } else if (res.type === 'shop') {
      const stats = computeStats(run, bonuses);
      const affordable = run.shop.filter((it) => it.kind === 'ability' && run.gold >= it.price * 1.5);
      affordable.sort((a, b) => abilityScore(b.id, run, stats) - abilityScore(a.id, run, stats));
      if (affordable.length && abilityScore(affordable[0].id, run, stats) >= 1.6) buyItem(run, affordable[0]);
    } else if (res.type === 'event') {
      resolveEvent(run, run.event.choices[run.event.choices.length - 1], bonuses);
    } else if (res.type === 'rest') {
      applyRest(run, 'sleep');
    }
    finishFloor(run);
  }
  return runSummary(run);
}

async function main() {
  const meta = buildMeta(TIER);
  const results = {};
  for (const cls of Object.keys(CLASSES)) {
    const floors = [], acts = [], bosses = [];
    for (let i = 0; i < RUNS; i++) {
      const s = playRun(1000 + i * 7919, cls, meta);
      floors.push(s.floor);
      acts.push(s.actsCleared);
      bosses.push(s.bosses);
    }
    const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
    results[cls] = {
      avgFloor: avg(floors), maxFloor: Math.max(...floors),
      avgActs: avg(acts), act1ClearPct: Math.round(100 * acts.filter((a) => a >= 1).length / RUNS),
      act3ClearPct: Math.round(100 * acts.filter((a) => a >= 3).length / RUNS),
    };
  }
  console.log(JSON.stringify({ runsPerClass: RUNS, results }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
