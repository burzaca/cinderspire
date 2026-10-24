// Isolate: take the exact build a sim run carries into the boss fight, then
// fight the boss 30x with that build. Tells us if builds are weak or play is bad.
import { startRun, enterDoor, buildCombat, applyVictory, takeSpoil, chooseBoon, finishFloor, computeStats, applyRest, resolveEvent, abilityDef } from '../src/run.js';
import { makeEntity, Combat, autopilot } from '../src/engine.js';
import { defaultMeta, metaBonuses } from '../src/meta.js';
import { ENEMIES, ENEMY_ABILITIES } from '../src/data.js';
import { makeRng } from '../src/rng.js';
import { pickDoor } from './sim_helpers.js';

const cls = process.argv[2] || 'emberwright';
const meta = defaultMeta();
const bonuses = metaBonuses(meta);

function playUntilBoss(seed) {
  const run = startRun({ seed, cls, metaBonuses: bonuses });
  while (run.floor <= 8) {
    while (run.pendingBoons && run.pendingBoons.length) chooseBoon(run, run.pendingBoons[0]);
    const door = pickDoor(run, bonuses);
    const res = enterDoor(run, door);
    if (res.type === 'boss') return run;
    if (res.type === 'combat' || res.type === 'elite') {
      const combat = buildCombat(run, res.encounter, bonuses);
      combat.runToCompletion(autopilot(), 600);
      if (!combat.win) return null;
      const { spoils } = applyVictory(run, combat, bonuses);
      takeSpoil(run, spoils.find((s) => s.kind === 'ability') || spoils[0]);
    } else if (res.type === 'rest') {
      applyRest(run, 'sleep');
    } else if (res.type === 'event') {
      resolveEvent(run, run.event.choices[run.event.choices.length - 1], bonuses);
    }
    finishFloor(run);
  }
  return null;
}

let found = 0;
for (let seed = 1000; seed < 1200 && found < 3; seed++) {
  const run = await playUntilBoss(seed);
  if (!run) continue;
  found++;
  const stats = computeStats(run, bonuses);
  console.log(`seed ${seed} build: hp=${stats.maxHp} atk=${stats.atk} as=${stats.atkSpeed} mr=${stats.manaRegen} armor=${stats.armor} ls=${stats.lifesteal || 0}`);
  console.log('  abilities:', run.abilities.map((a) => a.id + 'x' + a.level).join(', '));
  console.log('  relics:', run.relics.join(', ') || 'none');
  // fight boss 30x with this build
  let wins = 0;
  const tpl = ENEMIES.cinder_warden;
  for (let i = 0; i < 30; i++) {
    const rng = makeRng(77000 + i);
    const player = makeEntity({ ...stats, name: cls, glyph: '☗' }, 'player');
    const enemy = makeEntity({ ...tpl.stats, name: tpl.name, glyph: tpl.glyph }, 'enemy');
    const ea = { [tpl.name]: tpl.abilities.map((id) => ({ id, ...ENEMY_ABILITIES[id] })) };
    const abilities = run.abilities.map((a) => ({ id: a.id, def: abilityDef(a) }));
    const c = new Combat({ rng, player, enemies: [enemy], abilities, enemyAbilities: ea });
    c.runToCompletion(autopilot(), 600);
    if (c.win) wins++;
  }
  console.log(`  boss win rate with this build: ${Math.round((100 * wins) / 30)}%`);
}
