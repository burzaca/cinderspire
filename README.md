# 🗼 CINDERSPIRE

**an incremental roguelike** — climb a burning tower in real-time auto-battler combat, die, and let the Forge earn embers while you sleep.

🎮 **[PLAY IT → burzaca.github.io/cinderspire](https://burzaca.github.io/cinderspire/)**

Built in ~10 hours of autonomous overnight development (2026-10-24/25). Zero dependencies, zero build step: it's plain ES modules — the same engine runs in your browser and in a headless Node balance simulator.

---

## The loop

```
        ┌──────────────────────────  THE TOWER (roguelike)  ──────────────────────────┐
        │ pick doors: ⚔️ fight · 👹 elite · ❓ event · 🪙 trader · 🛏️ camp · 🔥 BOSS   │
        │ real-time combat: you auto-attack; YOU fire the abilities (mana + cooldowns) │
        │ spoils: abilities · relics · potions · gold — level up, reshape mid-run      │
        └───────────────┬──────────────────────────────────────────────────────────────┘
                        ▼  death banks everything
        ┌──────────────────────────  THE FORGE (incremental)  ────────────────────────┐
        │ embers buy permanent upgrades + idle income (earns while you're away,        │
        │ offline cap 8h) · Reforge resets upgrades for Cinders = permanent multiplier │
        └──────────────────────────────────────────────────────────────────────────────┘
```

- **Combat is real-time.** Your hero and the foes auto-attack on attack-speed timers. Your job is the ability bar: burn stacks, curses tick, shields soak, heals land at the right moment. Pause / 1×–3× speed / 🤖 autopilot included.
- **The climb is a marathon.** HP carries between fights; camps, salves and lucky events decide whether you reach the boss gate (where you always make camp first).
- **Endless scaling.** Three acts — the Smoldering Stairs, the Hollow Forge, the Pale Choir — then the tower loops, harder, forever.
- **The Forge never sleeps.** Idle ember income scales with your best floor. Reforge for Cinders. Numbers go up while you sleep.
- **Deterministic.** Every run is seeded; Daily runs give the whole world the same tower.

## Contents

| | |
|---|---|
| 3 classes | 🔥 Emberwright (burn amplifiers) · ⚙️ Ironsoul (shields, thorns) · 💀 Gravetongue (curses, lifesteal) |
| 33 abilities | mana/cooldown gated, 3 upgrade levels each |
| 14 relics | permanent-for-the-run stat artifacts, incl. a one-use revive |
| 19 enemies + 3 bosses | with their own ability AI (slams, hexes, war cries, self-heals) |
| 10 events, 4 potions, 10 level-up boons | the soft parts of a hard tower |
| 10 Forge upgrades + Reforge prestige + 10 achievements + idle income | the incremental part |

## Balance, measured not vibes

`scripts/simulate.js` plays full runs with the same autopilot the 🤖 button uses, plus a spoils/shop policy that scores ability value like a decent player. Two tiers, 60 runs/class:

**Fresh Forge (new player):**

| class | avg floor | act 1 clears | act 3 clears |
|---|---|---|---|
| Emberwright | 12.2 | 70% | 0% |
| Ironsoul | 12.1 | 60% | 0% |
| Gravetongue | 12.1 | 65% | 2% (deepest observed: floor 60) |

**Seasoned Forge (a spread of permanent upgrades):**

| class | avg floor | act 1 clears | act 3 clears |
|---|---|---|---|
| Emberwright | 16.1 | 100% | 0% |
| Ironsoul | 25.6 | 100% | 15% |
| Gravetongue | 32.7 | 98% | 45% (deepest observed: floor 61) |

That delta *is* the design: the Forge converts act-1 losses into act-3 clears. The autopilot is a mediocre player — humans do better. Class identity is intentional: Emberwright is the strongest early climber and the weakest endurer (burst/AoE, no sustain — it falls off against high-HP act-3 bosses); Gravetongue is the opposite. The autopilot's heal-when-hurt policy under-plays burst classes, so treat the late-game gap as a ceiling, not a floor. Tuning is done by changing data and re-running the sim, never by feel.

## Run it

```bash
git clone https://github.com/burzaca/cinderspire
cd cinderspire
python3 -m http.server 8080     # or any static server
open http://localhost:8080
```

```bash
npm test                        # engine + run-flow + meta test suite
npm run sim                     # headless balance report
```

## Architecture

```
src/
  rng.js      seeded mulberry32 + state save/restore (daily seeds, replays)
  engine.js   real-time fixed-timestep combat; symmetric player/enemy entities
  data.js     ALL content as data — cards, enemies, events, forge, achievements
  run.js      the climb: doors, encounters, scaling, spoils, shop, events, saves
  meta.js     the Forge: embers, idle income, prestige, achievements
  save.js     localStorage wrapper (in-memory under Node)
  ui/main.js  screens + rAF loop over the engine (no framework)
scripts/
  simulate.js headless autoplay balance sim
  probe_boss.js / probe_build.js / trace_fight.js   balance forensics
tests/        node:test suites
```

The engine is UI-free and deterministic: the browser, the tests and the balance sim all drive the exact same code.

## Known rough edges (honest list)

- No music, only a tiny synth. Sound is off by default.
- The Pale Choir (act 3) is a wall past ~floor 24 with a fresh Forge — by design it's the "many Reforges later" goal, but it could use more mid-run power spikes.
- No cloud saves; progress lives in your browser's localStorage.

MIT licensed. Made by Anakin (Hermes agent) for muha7a, overnight, while he slept.
