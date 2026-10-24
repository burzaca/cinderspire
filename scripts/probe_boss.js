// Quick probe: win-rate of a typical mid-run player vs each boss, at full HP
// and at 60% HP. Usage: node scripts/probe_boss.js
import { makeRng } from '../src/rng.js';
import { makeEntity, Combat, autopilot } from '../src/engine.js';
import { CLASSES, ENEMIES, ENEMY_ABILITIES } from '../src/data.js';

function fight(cls, bossKey, hpPct, boons, n = 60) {
  let wins = 0, totalTime = 0;
  const bossTpl = ENEMIES[bossKey];
  for (let i = 0; i < n; i++) {
    const rng = makeRng(5000 + i * 104729);
    const stats = { ...CLASSES[cls].stats };
    for (const b of boons) for (const [k, v] of Object.entries(b)) stats[k] = (stats[k] || 0) + v;
    const player = makeEntity({ ...stats, name: cls, glyph: '☗' }, 'player');
    player.hp = Math.round(player.maxHp * hpPct);
    const st = { ...bossTpl.stats };
    const enemy = makeEntity({ ...st, name: bossTpl.name, glyph: bossTpl.glyph }, 'enemy');
    const enemyAbilities = { [bossTpl.name]: (bossTpl.abilities || []).map((id) => ({ id, ...ENEMY_ABILITIES[id] })) };
    const abilities = CLASSES[cls].start.map((id) => {
      const base = { ...({ ...importAbility(id) }) };
      return { id, def: base };
    });
    const c = new Combat({ rng, player, enemies: [enemy], abilities, enemyAbilities });
    c.runToCompletion(autopilot(), 600);
    if (c.win) { wins++; totalTime += c.time; }
  }
  return { cls, boss: bossKey, hpPct, winPct: Math.round((100 * wins) / n), avgTime: (totalTime / Math.max(1, wins)).toFixed(1) };
}

function importAbility(id) {
  // lazy require to avoid top-level await
  const mod = abilityCache[id];
  return mod;
}
let abilityCache = null;
await import('../src/data.js').then((m) => { abilityCache = m.ABILITIES; });

const act1Boons = [{ maxHp: 12 }, { atk: 2 }, { manaRegen: 2 }];
const act2Boons = [{ maxHp: 24 }, { atk: 4 }, { manaRegen: 4 }, { atkSpeed: 0.08 }];
const act3Boons = [{ maxHp: 36 }, { atk: 6 }, { manaRegen: 6 }, { atkSpeed: 0.16 }, { armor: 2 }];

for (const [boss, boons] of [['cinder_warden', act1Boons], ['hollow_smith', act2Boons], ['pale_choir', act3Boons]]) {
  for (const cls of Object.keys(CLASSES)) {
    console.log(JSON.stringify(fight(cls, boss, 1.0, boons)));
    console.log(JSON.stringify(fight(cls, boss, 0.6, boons)));
  }
}
