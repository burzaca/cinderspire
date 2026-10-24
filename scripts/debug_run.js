// Debug: replay sim runs and dump the boss fight state for inspection.
import { startRun, enterDoor, buildCombat, applyVictory, takeSpoil, chooseBoon, finishFloor, computeStats } from '../src/run.js';
import { autopilot } from '../src/engine.js';
import { defaultMeta, metaBonuses } from '../src/meta.js';
import { pickDoor } from './sim_helpers.js';

const cls = process.argv[2] || 'emberwright';
const meta = defaultMeta();
const bonuses = metaBonuses(meta);
const run = startRun({ seed: 1000, cls, metaBonuses: bonuses });
while (run.floor <= 8) {
  while (run.pendingBoons && run.pendingBoons.length) chooseBoon(run, run.pendingBoons[0]);
  const door = pickDoor(run, bonuses);
  console.log(`floor ${run.floor}: door=${door.type}`);
  const res = enterDoor(run, door);
  if (res.type === 'combat' || res.type === 'elite' || res.type === 'boss') {
    const combat = buildCombat(run, res.encounter, bonuses);
    if (res.type === 'boss') {
      console.log('  player:', JSON.stringify({ hp: combat.player.hp, maxHp: combat.player.maxHp, atk: combat.player.atk, mr: combat.player.manaRegen }));
      console.log('  abilities:', run.abilities.map((a) => a.id + 'x' + a.level).join(', '));
      console.log('  boss:', combat.enemies[0].name, 'hp', combat.enemies[0].maxHp, 'atk', combat.enemies[0].atk);
    }
    combat.runToCompletion(autopilot(), 600);
    console.log(`  combat ${res.type}: win=${combat.win} time=${combat.time.toFixed(1)} playerHpLeft=${combat.player.hp}`);
    if (!combat.win) break;
    const { spoils } = applyVictory(run, combat, bonuses);
    takeSpoil(run, spoils.find((s) => s.kind === 'ability') || spoils[0]);
  } else if (res.type === 'shop') {
    // skip
  } else if (res.type === 'event') {
    const { resolveEvent } = await import('../src/run.js');
    resolveEvent(run, run.event.choices[run.event.choices.length - 1], bonuses);
  } else if (res.type === 'rest') {
    const { applyRest } = await import('../src/run.js');
    applyRest(run, 'sleep');
  }
  finishFloor(run);
}
