// Trace one boss fight cast-by-cast for a sim build.
import { startRun, enterDoor, buildCombat, applyVictory, takeSpoil, chooseBoon, finishFloor, computeStats, applyRest, resolveEvent, abilityDef } from '../src/run.js';
import { makeEntity, Combat, autopilot, TICK } from '../src/engine.js';
import { defaultMeta, metaBonuses } from '../src/meta.js';
import { ENEMIES, ENEMY_ABILITIES } from '../src/data.js';
import { makeRng } from '../src/rng.js';
import { pickDoor } from './sim_helpers.js';

const cls = 'emberwright';
const meta = defaultMeta();
const bonuses = metaBonuses(meta);
const run = startRun({ seed: 1001, cls, metaBonuses: bonuses });
while (run.floor < 8) {
  while (run.pendingBoons && run.pendingBoons.length) chooseBoon(run, run.pendingBoons[0]);
  const door = pickDoor(run, bonuses);
  const res = enterDoor(run, door);
  if (res.type === 'combat' || res.type === 'elite') {
    const combat = buildCombat(run, res.encounter, bonuses);
    combat.runToCompletion(autopilot(), 600);
    if (!combat.win) { console.log('died at floor', run.floor); process.exit(0); }
    const { spoils } = applyVictory(run, combat, bonuses);
    takeSpoil(run, spoils.find((s) => s.kind === 'ability') || spoils[0]);
  } else if (res.type === 'rest') applyRest(run, 'sleep');
  else if (res.type === 'event') resolveEvent(run, run.event.choices[run.event.choices.length - 1], bonuses);
  finishFloor(run);
}
const stats = computeStats(run, bonuses);
console.log('build:', JSON.stringify({ hp: stats.maxHp, atk: stats.atk, mr: stats.manaRegen }));
console.log('abilities:', run.abilities.map((a) => a.id).join(', '));

const tpl = ENEMIES.cinder_warden;
const rng = makeRng(4242);
const player = makeEntity({ ...stats, name: cls, glyph: '☗' }, 'player');
const enemy = makeEntity({ ...tpl.stats, name: tpl.name, glyph: tpl.glyph }, 'enemy');
const ea = { [tpl.name]: tpl.abilities.map((id) => ({ id, ...ENEMY_ABILITIES[id] })) };
const abilities = run.abilities.map((a) => ({ id: a.id, def: abilityDef(a) }));
const c = new Combat({ rng, player, enemies: [enemy], abilities, enemyAbilities: ea });
let lastCast = -1;
while (!c.done && c.time < 120) {
  autopilot()(c);
  for (const ev of c.events) {
    if (ev.kind === 'cast' && ev.src === player) {
      console.log(`t=${c.time.toFixed(1)} CAST ${ev.ability.name} (cost ${ev.ability.cost}) mana=${Math.round(player.mana)} enemyHp=${enemy.hp} myHp=${player.hp}`);
    }
  }
  c.events.length = 0;
  c.step();
}
console.log(`done=${c.done} win=${c.win} time=${c.time.toFixed(1)} enemyHp=${enemy.hp} myHp=${player.hp}`);
