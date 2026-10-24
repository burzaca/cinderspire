// CINDERSPIRE combat engine — real-time, fixed timestep, deterministic.
// Player and enemies are symmetric entities: they auto-attack on attack-speed
// timers; abilities are instant effects gated by mana + cooldown. The same
// engine runs in the browser (rAF) and headless (balance sim / tests).

export const TICK = 0.05; // seconds per simulation step

export function makeEntity(base, side) {
  const e = {
    side,
    name: base.name || (side === 'player' ? 'You' : 'Foe'),
    maxHp: base.maxHp ?? 60,
    atk: base.atk ?? 8,
    atkSpeed: base.atkSpeed ?? 1.0,
    armor: base.armor ?? 0,
    crit: base.crit ?? 0.05,
    critMult: base.critMult ?? 0,
    lifesteal: base.lifesteal ?? 0,
    thorns: base.thorns ?? 0,
    regen: base.regen ?? 0,
    manaMax: base.manaMax ?? 100,
    manaRegen: base.manaRegen ?? 10,
    burnAmp: base.burnAmp ?? 0,
    curseAmp: base.curseAmp ?? 0,
    cdr: base.cdr ?? 0,
    revives: base.revives ?? 0,
    luck: base.luck ?? 0,
    goldBonus: base.goldBonus ?? 0,
    glyph: base.glyph || (side === 'player' ? '☗' : '☠'),
    // runtime state
    hp: 0, shield: 0, mana: 0,
    burn: 0, burnT: 0, curse: 0, curseT: 0,
    slow: 0, weaken: 0, buff: 0, buffT: 0,
    atkTimer: 0, castTimer: 0, cd: {}, alive: true,
  };
  e.hp = e.maxHp;
  e.mana = base.startMana ?? 30;
  return e;
}

function effAtkSpeed(e) { return e.atkSpeed * Math.max(0.25, 1 - 0.15 * Math.min(e.slow, 3)); }
function effAtk(e) {
  let a = e.atk;
  if (e.buff > 0) a *= 1 + 0.08 * e.buff;
  if (e.weaken > 0) a *= Math.max(0.4, 1 - 0.1 * Math.min(e.weaken, 5));
  return a;
}

export class Combat {
  constructor({ rng, player, enemies, abilities = [], enemyAbilities = {}, log = [] }) {
    this.rng = rng;
    this.player = player;
    this.enemies = enemies;
    this.abilities = abilities;   // [{id, def}] player ability defs (def = data.abilities entry)
    this.enemyAbilities = enemyAbilities; // enemyName -> [defs]
    this.time = 0;
    this.log = log;
    this.done = false;
    this.win = false;
    this.events = []; // per-frame events for the UI: {kind, src, tgt, amount, crit}
  }

  emit(ev) { if (this.events.length < 200) this.events.push(ev); }
  aliveEnemies() { return this.enemies.filter((e) => e.alive); }

  rollDamage(att, def, mult = 1) {
    let base = effAtk(att) * mult * this.rng.range(0.9, 1.1);
    const crit = this.rng.chance(att.crit);
    if (crit) base *= 1.5 + att.critMult;
    const dmg = Math.max(1, base * Math.max(0.15, 1 - def.armor * 0.04));
    return { dmg: Math.round(dmg), crit };
  }

  applyDamage(tgt, dmg, src = null, opts = {}) {
    if (!tgt.alive || dmg <= 0) return 0;
    let rest = dmg;
    if (tgt.shield > 0) {
      const absorbed = Math.min(tgt.shield, rest);
      tgt.shield -= absorbed; rest -= absorbed;
      if (absorbed) this.emit({ kind: 'shield', tgt, amount: absorbed });
    }
    tgt.hp = Math.max(0, tgt.hp - rest);
    if (src) {
      if (src.lifesteal > 0 && rest > 0) {
        const heal = Math.round(rest * src.lifesteal);
        if (heal > 0 && src.alive) {
          src.hp = Math.min(src.maxHp, src.hp + heal);
          this.emit({ kind: 'heal', tgt: src, amount: heal });
        }
      }
      if (!opts.noThorns && tgt.thorns > 0 && tgt.alive && opts.melee !== false) {
        const t = tgt.thorns;
        src.hp = Math.max(0, src.hp - t);
        this.emit({ kind: 'thorns', tgt: src, amount: t });
        if (src.hp <= 0) this.checkDeath(src);
      }
    }
    if (tgt.hp <= 0) this.checkDeath(tgt);
    return rest;
  }

  checkDeath(e) {
    if (e.hp <= 0 && e.alive) {
      if (e.side === 'player' && e.revives > 0) {
        e.revives -= 1;
        e.hp = Math.round(e.maxHp * 0.35);
        e.shield = 0;
        this.emit({ kind: 'revive', tgt: e });
        return;
      }
      e.alive = false;
      this.emit({ kind: 'death', tgt: e });
      if (e.side === 'player') { this.done = true; this.win = false; }
      else if (this.aliveEnemies().length === 0) { this.done = true; this.win = true; }
    }
  }

  // ---- ability effects (instant) -------------------------------------------
  cast(player, abilityDef, targetIdx = 0) {
    const def = abilityDef;
    if (!player.alive || this.done) return { ok: false, reason: 'over' };
    const cdLeft = player.cd[def.id] || 0;
    if (cdLeft > 0) return { ok: false, reason: 'cooldown' };
    if (player.mana < def.cost) return { ok: false, reason: 'mana' };
    player.mana -= def.cost;
    player.cd[def.id] = def.cooldown * (1 - (player.cdr || 0));
    this.emit({ kind: 'cast', src: player, ability: def });

    const targets = def.aoe ? this.aliveEnemies() : [this.aliveEnemies()[Math.min(targetIdx, this.aliveEnemies().length - 1)]].filter(Boolean);
    if (def.selfDamage) this.applyDamage(player, def.selfDamage, null, { noThorns: true, melee: false });

    for (const t of targets) {
      if (!t || !t.alive) continue;
      let power = def.power;
      if (def.executePower && t.hp / t.maxHp <= (def.executeBelow || 0.3)) power = def.executePower;
      if (power) {
        const { dmg, crit } = this.rollDamage(player, t, power);
        this.applyDamage(t, dmg, player, { melee: !def.aoe });
        this.emit({ kind: crit ? 'crit' : 'hit', src: player, tgt: t, amount: dmg, crit });
      }
      if (def.hits && def.power) {
        for (let i = 1; i < def.hits; i++) {
          if (!t.alive) break;
          const { dmg, crit } = this.rollDamage(player, t, def.power * 0.45);
          this.applyDamage(t, dmg, player, { melee: !def.aoe });
          this.emit({ kind: crit ? 'crit' : 'hit', src: player, tgt: t, amount: dmg, crit });
        }
      }
      if (def.burn) { t.burn = Math.min(30, t.burn + def.burn); t.burnT = Math.max(t.burnT, 2); }
      if (def.curse) { t.curse = Math.min(30, t.curse + def.curse); t.curseT = Math.max(t.curseT, 3); }
      if (def.slow) t.slow = Math.min(3, t.slow + def.slow);
      if (def.weaken) t.weaken = Math.min(5, t.weaken + def.weaken);
    }
    if (def.shield) player.shield += def.shield;
    if (def.buff) { player.buff = Math.min(10, player.buff + def.buff); player.buffT = 8; }
    if (def.heal) {
      const h = Math.round(def.heal + (def.healPctOfAtk ? def.healPctOfAtk * effAtk(player) : 0));
      player.hp = Math.min(player.maxHp, player.hp + h);
      this.emit({ kind: 'heal', tgt: player, amount: h });
    }
    if (def.mana) player.mana = Math.min(player.manaMax, player.mana + def.mana);
    if (def.burnAmp) player.burnAmp += def.burnAmp;
    if (def.curseAmp) player.curseAmp += def.curseAmp;
    if (def.cdr) player.cdr = Math.min(0.5, (player.cdr || 0) + def.cdr);
    if (def.thornsGain) player.thorns += def.thornsGain;
    return { ok: true };
  }

  // ---- entity ticks ---------------------------------------------------------
  tickEntity(e, dt) {
    if (!e.alive) return;
    e.mana = Math.min(e.manaMax, e.mana + e.manaRegen * dt);
    if (e.regen > 0) e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
    for (const k of Object.keys(e.cd)) if (e.cd[k] > 0) e.cd[k] = Math.max(0, e.cd[k] - dt);
    if (e.buffT > 0) { e.buffT -= dt; if (e.buffT <= 0) e.buff = 0; }

    // damage over time
    if (e.burn > 0) {
      e.burnT -= dt;
      if (e.burnT <= 0) {
        e.burnT = 2;
        const dmg = Math.round(e.burn * (1 + (e.burnAmp || 0)));
        e.hp = Math.max(0, e.hp - dmg);
        this.emit({ kind: 'burn', tgt: e, amount: dmg });
        if (e.hp <= 0) this.checkDeath(e);
      }
    }
    if (e.alive && e.curse > 0) {
      e.curseT -= dt;
      if (e.curseT <= 0) {
        e.curseT = 3;
        const dmg = Math.round(e.curse * 1.2 * (1 + (e.curseAmp || 0)));
        e.hp = Math.max(0, e.hp - dmg);
        this.emit({ kind: 'curse', tgt: e, amount: dmg });
        if (e.hp <= 0) this.checkDeath(e);
      }
    }
    if (!e.alive) return;

    // auto attack
    e.atkTimer += dt;
    const interval = 1 / effAtkSpeed(e);
    if (e.atkTimer >= interval) {
      e.atkTimer = 0;
      if (e.side === 'player') {
        const t = this.aliveEnemies()[0];
        if (t) {
          const { dmg, crit } = this.rollDamage(e, t);
          this.applyDamage(t, dmg, e, { melee: true });
          this.emit({ kind: crit ? 'crit' : 'auto', src: e, tgt: t, amount: dmg, crit });
        }
      } else {
        const { dmg, crit } = this.rollDamage(e, this.player);
        this.applyDamage(this.player, dmg, e, { melee: true });
        this.emit({ kind: crit ? 'crit' : 'auto', src: e, tgt: this.player, amount: dmg, crit });
      }
    }

    // enemy ability AI: evaluate every 0.5s
    if (e.side === 'enemy') {
      e.castTimer += dt;
      if (e.castTimer >= 0.5) {
        e.castTimer = 0;
        const defs = this.enemyAbilities[e.name] || [];
        for (const def of defs) {
          const cdLeft = e.cd[def.id] || 0;
          if (cdLeft > 0 || e.mana < def.cost) continue;
          if (def.needsLowHp && e.hp > e.maxHp * 0.5) continue;
          if (this.rng.chance(def.ai ?? 0.85)) {
            e.mana -= def.cost;
            e.cd[def.id] = def.cooldown;
            this.emit({ kind: 'cast', src: e, ability: def });
            if (def.power) {
              const { dmg, crit } = this.rollDamage(e, this.player, def.power);
              this.applyDamage(this.player, dmg, e, { melee: false });
              this.emit({ kind: crit ? 'crit' : 'hit', src: e, tgt: this.player, amount: dmg, crit });
            }
            if (def.burn) { this.player.burn = Math.min(30, this.player.burn + def.burn); this.player.burnT = Math.max(this.player.burnT, 2); }
            if (def.weaken) this.player.weaken = Math.min(5, this.player.weaken + def.weaken);
            if (def.slow) this.player.slow = Math.min(3, this.player.slow + def.slow);
            if (def.shield) e.shield += def.shield;
            if (def.buff) { e.buff = Math.min(10, e.buff + def.buff); e.buffT = 8; }
            if (def.heal) e.hp = Math.min(e.maxHp, e.hp + def.heal);
            break; // one ability per evaluation window
          }
        }
      }
    }
  }

  step(dt = TICK) {
    if (this.done) return;
    this.time += dt;
    this.tickEntity(this.player, dt);
    if (!this.done) for (const e of this.enemies) this.tickEntity(e, dt);
  }

  runToCompletion(policy, maxSeconds = 240) {
    // headless driver; policy(combat) may cast abilities each step
    while (!this.done && this.time < maxSeconds) {
      if (policy) policy(this);
      this.step();
    }
    return this;
  }
}

// Default heuristic used by the balance simulator (and a fallback autopilot).
// Policy: damage first; defensive abilities only when genuinely in danger;
// cheap abilities are de-weighted so mana goes to real hits.
export const autopilot = (policyCfg = {}) => {
  const cfg = { dangerBelow: 0.35, minGap: 0.35, ...policyCfg };
  return (c) => {
    const p = c.player;
    if (!p.alive || c.done) return;
    c._gap = (c._gap || 0) - TICK;
    if (c._gap > 0) return;
    const ready = c.abilities.filter(({ def }) => (p.cd[def.id] || 0) <= 0 && p.mana >= def.cost);
    if (!ready.length) return;
    // mana management: refill when low and a refill ability is up
    if (p.mana < 25) {
      const refill = ready.find(({ def }) => def.mana > 0);
      if (refill) {
        const r = c.cast(p, refill.def, 0);
        if (r.ok) { c._gap = cfg.minGap; return; }
      }
    }
    const hurt = p.hp < p.maxHp * cfg.dangerBelow;
    const many = c.aliveEnemies().length >= 2;
    const score = (def) => {
      let s = 0;
      if (def.power) s += def.power * (def.aoe && many ? 1.8 : 1) * (def.hits ? 1.4 : 1);
      if (def.executePower) s += 0.8;
      if (def.burn) s += def.burn * 0.4;
      if (def.curse) s += def.curse * 0.5;
      if (hurt) {
        if (def.heal) s += def.heal / 15 + 1.5;
        if (def.shield) s += def.shield / 15 + 1;
        if (def.buff) s += def.buff * 0.6;
      } else {
        if (def.heal) s -= 4;
        if (def.shield) s -= 2;
      }
      if (def.burnAmp) s += 2.2;
      if (def.curseAmp) s += 2.2;
      if (def.slow || def.weaken) s += 0.8;
      return s / Math.max(def.cost, 18);
    };
    ready.sort((a, b) => score(b.def) - score(a.def));
    const best = ready[0];
    if (score(best.def) <= 0) return;
    const r = c.cast(p, best.def, 0);
    if (r.ok) c._gap = cfg.minGap;
  };
}
