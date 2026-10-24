// CINDERSPIRE UI controller. State machine + real-time loop over the engine.
import { makeRng, hashSeed, todaySeed } from '../rng.js';
import { makeEntity, Combat, TICK, autopilot } from '../engine.js';
import {
  startRun, enterDoor, buildCombat, applyVictory, takeSpoil, chooseBoon,
  finishFloor, runSummary, computeStats, buyItem, upgradeAbility, upgradeCost,
  resolveEvent, applyRest, serializeRun, deserializeRun, abilityDef,
  actOf, floorInAct, baseActOf,
} from '../run.js';
import {
  defaultMeta, metaBonuses, buyForge, forgeCost, forgeLevel, unlockClass,
  reforge, pendingCinders, applyRunResult, collectIdle, idleRate, cinderMult,
} from '../meta.js';
import { loadJSON, saveJSON, clearAll } from '../save.js';
import { CLASSES, ABILITIES, RELICS, POTIONS, ACT_NAMES, FORGE, ACHIEVEMENTS, ENEMY_ABILITIES } from '../data.js';

const $ = (s) => document.querySelector(s);
const screenEl = $('#screen');
const hudEl = $('#hud');

const S = {
  meta: null, run: null, combat: null, combatUI: null,
  screen: 'title', speed: 1, paused: false, auto: false,
  raf: 0, acc: 0, lastT: 0, pendingIdle: null,
};

/* ---------------- persistence ---------------- */
function saveMeta() { S.meta.lastSeen = Date.now(); saveJSON('meta', S.meta); }
function saveRun() {
  if (!S.run) { saveJSON('run', null); return; }
  const data = serializeRun(S.run);
  if (S.combat && !S.combat.done) data.combat = serializeCombat(S.combat);
  saveJSON('run', data);
}
function serializeCombat(c) {
  return {
    player: c.player, enemies: c.enemies, time: c.time,
    rngState: c.rng.getState(),
  };
}
function deserializeCombat(data, run) {
  const rng = makeRng(run.seed);
  rng.setState(data.rngState);
  const enemyAbilities = {};
  for (const e of data.enemies) {
    if (e.tpl && e.tpl.abilities) {
      enemyAbilities[e.name] = e.tpl.abilities.map((id) => ({ id, ...ENEMY_ABILITIES[id] }));
    }
  }
  const c = new Combat({
    rng, player: data.player, enemies: data.enemies,
    abilities: run.abilities.map((a) => ({ id: a.id, def: abilityDef(a) })),
    enemyAbilities,
  });
  c.time = data.time;
  return c;
}

/* ---------------- tiny synth ---------------- */
let actx = null;
function beep(kind) {
  if (!S.meta.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    const map = { cast: [440, .05], hit: [220, .04], crit: [660, .07], die: [110, .18], win: [520, .12], coin: [880, .05], bad: [160, .12] };
    const [f, d] = map[kind] || [330, .05];
    o.frequency.value = f + Math.random() * 40;
    o.type = kind === 'die' || kind === 'bad' ? 'sawtooth' : 'triangle';
    g.gain.value = 0.04;
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + d);
  } catch (_) {}
}

/* ---------------- helpers ---------------- */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function toast(msg, ms = 2200) {
  let t = $('#toast');
  if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}
function modal(title, bodyNodes, actions = []) {
  const back = el('div', 'modal-back');
  const m = el('div', 'modal');
  m.appendChild(el('h3', null, title));
  for (const n of bodyNodes) m.appendChild(n);
  for (const [label, fn, cls] of actions) {
    const b = el('button', 'btn ' + (cls || ''), label);
    b.onclick = () => { back.remove(); fn && fn(); };
    m.appendChild(b);
  }
  back.appendChild(m);
  back.onclick = (e) => { if (e.target === back) back.remove(); };
  document.body.appendChild(back);
  return back;
}
function barEl(kind, cur, max, shield = 0, label = true) {
  const bar = el('div', `bar ${kind}`);
  const fill = el('i');
  fill.style.width = `${Math.max(0, Math.min(100, (cur / max) * 100))}%`;
  bar.appendChild(fill);
  if (shield > 0) {
    const seg = el('i', 'shieldseg');
    seg.style.left = `${(cur / max) * 100}%`;
    seg.style.width = `${Math.min(100 - (cur / max) * 100, (shield / max) * 100)}%`;
    bar.appendChild(seg);
  }
  if (label) bar.appendChild(el('span', 'barlabel', `${Math.ceil(cur)}/${max}${shield > 0 ? ` +${shield}` : ''}`));
  bar._fill = fill;
  return bar;
}
function statusChips(e) {
  const out = [];
  if (e.shield > 0) out.push(['shield', `🛡 ${Math.round(e.shield)}`]);
  if (e.burn > 0) out.push(['burn', `🔥 ${e.burn}`]);
  if (e.curse > 0) out.push(['curse', `🕸 ${e.curse}`]);
  if (e.slow > 0) out.push(['slow', `❄ ${e.slow}`]);
  if (e.weaken > 0) out.push(['weaken', `🥀 ${e.weaken}`]);
  if (e.buff > 0) out.push(['buff', `💪 ${e.buff}`]);
  return out.map(([k, t]) => el('span', `status ${k}`, t));
}
function abilityText(def) {
  const bits = [];
  if (def.power) bits.push(`${Math.round(def.power * 100)}% damage${def.aoe ? ' (all)' : ''}${def.hits ? ` ×${def.hits}` : ''}`);
  if (def.executePower) bits.push(`${Math.round(def.executePower * 100)}% if target &lt;30%`);
  if (def.burn) bits.push(`+${def.burn} burn`);
  if (def.curse) bits.push(`+${def.curse} curse`);
  if (def.slow) bits.push(`slow ${def.slow}`);
  if (def.weaken) bits.push(`weaken ${def.weaken}`);
  if (def.shield) bits.push(`+${def.shield} shield`);
  if (def.buff) bits.push(`+${def.buff} buff`);
  if (def.heal) bits.push(`heal ${def.heal}`);
  if (def.mana) bits.push(`+${def.mana} mana`);
  if (def.burnAmp) bits.push(`burn +${Math.round(def.burnAmp * 100)}%`);
  if (def.curseAmp) bits.push(`curse +${Math.round(def.curseAmp * 100)}%`);
  if (def.thornsGain) bits.push(`+${def.thornsGain} thorns`);
  if (def.cdr) bits.push(`-${Math.round(def.cdr * 100)}% cooldowns`);
  if (def.selfDamage) bits.push(`self ${def.selfDamage}`);
  return bits.join('\n');
}
const rarityTag = (r) => r && r !== 'common' ? `<span class="tag ${r}">${r}</span>` : '';

/* ---------------- HUD ---------------- */
function updateHud() {
  if (!S.run) { hudEl.hidden = true; return; }
  hudEl.hidden = false;
  const act = actOf(S.run);
  $('#hud-floor').innerHTML = `<span class="chip">🗼 Floor <b>${S.run.floor}</b> · Act ${act}</span>`;
  $('#hud-gold').innerHTML = `<span class="chip">🪙 <b>${S.run.gold}</b></span>`;
  $('#hud-embers').innerHTML = `<span class="chip embers">🔥 <b>${S.meta.embers}</b> <embers-label>embers</embers-label></span>`;
}

/* ---------------- screens ---------------- */
function clearScreen() { cancelAnimationFrame(S.raf); S.raf = 0; screenEl.innerHTML = ''; }

function renderTitle() {
  S.screen = 'title'; S.run = null; saveRun(); updateHud();
  clearScreen();
  const art = el('div', 'title-art');
  art.innerHTML = '<div class="tower"></div><div class="glow"></div>';
  screenEl.appendChild(art);
  spawnEmbers(art);
  screenEl.appendChild(el('h1', 'title', 'CINDERSPIRE'));
  screenEl.appendChild(el('p', 'sub', 'an incremental roguelike — climb the burning tower;<br>the Forge earns embers while you sleep'));
  const rate = idleRate(S.meta);
  if (rate > 0) {
    screenEl.appendChild(el('div', 'forge-banner',
      `Your Forge is producing <b>${rate.toFixed(2)} embers/sec</b> (offline cap 8h).`));
  }
  const btns = el('div', 'title-buttons');
  const bStart = el('button', 'btn primary', '🗼 Climb the tower');
  bStart.onclick = renderClasses;
  const bDaily = el('button', 'btn', '📅 Daily run <small>same tower for everyone today</small>');
  bDaily.onclick = () => renderClasses(todaySeed(new Date()));
  const bForge = el('button', 'btn', '⚒ The Forge <small>upgrades · idle income · reforge</small>');
  bForge.onclick = renderForge;
  const bHelp = el('button', 'btn ghost', 'How to play');
  bHelp.onclick = helpModal;
  btns.append(bStart, bDaily, bForge, bHelp);
  screenEl.appendChild(btns);
  if (S.pendingIdle) {
    modal('While you were away…', [
      el('p', null, `The Forge kept burning for ${fmtDur(S.pendingIdle.seconds)} and made <b style="color:var(--gold)">+${S.pendingIdle.gain} embers</b>.`),
    ], [['Keep climbing', null, 'primary']]);
    S.pendingIdle = null;
    saveMeta();
  }
}
function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m` : `${s}s`;
}
function spawnEmbers(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const n = innerWidth < 500 ? 14 : 26;
  for (let i = 0; i < n; i++) {
    const d = el('div', 'ember-dot');
    d.style.left = `${Math.random() * 100}%`;
    d.style.setProperty('--drift', `${(Math.random() * 80 - 40)}px`);
    d.style.animationDuration = `${5 + Math.random() * 7}s`;
    d.style.animationDelay = `${Math.random() * 8}s`;
    host.appendChild(d);
  }
}
function kitModal() {
  if (!S.run) return;
  const stats = computeStats(S.run, metaBonuses(S.meta));
  const nodes = [];
  const sline = `HP ${Math.round(stats.maxHp)} · ATK ${stats.atk} · SPD ${stats.atkSpeed.toFixed(2)} · ARM ${stats.armor} · MR ${Math.round(stats.manaRegen)} · CRIT ${Math.round(stats.crit * 100)}%`;
  nodes.push(el('p', null, sline));
  for (const a of S.run.abilities) {
    const def = abilityDef(a);
    const row = el('div', 'kit-row');
    row.innerHTML = `<span class="kicon">${def.icon}</span><div><div class="kname">${def.name}</div><div class="kdesc">${def.cost} mana · ${def.cooldown}s · ${abilityText(def)}</div></div><span class="klvl">Lv${a.level}</span>`;
    nodes.push(row);
  }
  if (S.run.relics.length) {
    nodes.push(el('div', 'section-head', 'Relics'));
    for (const r of S.run.relics) {
      const rel = RELICS[r];
      const row = el('div', 'kit-row');
      row.innerHTML = `<span class="kicon">${rel.icon}</span><div><div class="kname">${rel.name}</div><div class="kdesc">${rel.desc}</div></div>`;
      nodes.push(row);
    }
  }
  modal('Your kit', nodes, [['Close']]);
}

function renderClasses(seed) {
  S.screen = 'classes';
  clearScreen();
  screenEl.appendChild(el('h2', 'panel-title', 'Choose your climber'));
  const grid = el('div', 'class-grid');
  for (const [id, c] of Object.entries(CLASSES)) {
    const unlocked = !!S.meta.unlocked[id];
    const card = el('button', 'class-card btn' + (unlocked ? '' : ' locked'));
    card.innerHTML = `<span class="glyph">${c.glyph}</span><h3>${c.name}</h3>
      <p class="tagline">${c.tag}</p><p>${c.desc}</p>
      ${unlocked ? '' : `<p style="color:var(--gold)">Unlock: ${c.unlockCost} embers ${S.meta.embers >= c.unlockCost ? '— <b>tap to unlock</b>' : '(not enough)'}</p>`}`;
    card.onclick = () => {
      if (unlocked) return beginRun(id, seed);
      const r = unlockClass(S.meta, id);
      if (r.ok) { saveMeta(); toast(`${c.name} unlocked!`); renderClasses(seed); }
      else toast('Not enough embers yet.');
    };
    grid.appendChild(card);
  }
  screenEl.appendChild(grid);
  const back = el('button', 'btn ghost', '← back');
  back.onclick = renderTitle;
  screenEl.appendChild(back);
}

function beginRun(cls, seed) {
  const bonuses = metaBonuses(S.meta);
  const s = seed ?? (Math.random() * 2 ** 31) | 0;
  S.run = startRun({ seed: s, cls, metaBonuses: bonuses });
  saveRun();
  renderTower();
}

/* ---------------- tower ---------------- */
function renderTower() {
  S.screen = 'tower';
  clearScreen();
  updateHud();
  saveRun();
  const run = S.run;
  const bonuses = metaBonuses(S.meta);
  const stats = computeStats(run, bonuses);
  const head = el('div', 'tower-head');
  head.innerHTML = `<div class="act">Act ${actOf(run)} — ${ACT_NAMES[baseActOf(run)]}${actOf(run) > 3 ? ` (loop ${actOf(run)})` : ''}</div>
    <div class="floor">Floor ${run.floor}</div>`;
  const hpw = el('div', 'hpbar-wrap');
  const hp = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
  hpw.appendChild(barEl('hp', hp, stats.maxHp));
  head.appendChild(hpw);
  screenEl.appendChild(head);

  if (run.pendingBoons && run.pendingBoons.length) return renderLevelUp();

  const grid = el('div', 'doors');
  for (const door of run.doorOptions) {
    const meta2 = doorMeta(door.type);
    const d = el('button', `door ${door.type}`);
    d.innerHTML = `<span class="dicon">${meta2.icon}</span><span class="dlabel">${meta2.label}</span><span class="dsub">${meta2.sub}</span>`;
    d.onclick = () => takeDoor(door);
    grid.appendChild(d);
  }
  screenEl.appendChild(grid);

  // potions usable before a fight too
  const potHost = el('div');
  screenEl.appendChild(potHost);
  renderPotionBar(potHost, (idx) => {
    if (idx == null) return;
    usePotion(idx, null);
  }, true);

  const abandon = el('button', 'btn ghost', 'Abandon run (bank embers)');
  abandon.onclick = () => {
    modal('Abandon run?', [el('p', null, 'Your embers so far will be banked.')], [
      ['Abandon', () => endRun(false), 'danger'], ['Keep climbing'],
    ]);
  };
  const kitBtn = el('button', 'btn', '🎒 Your kit');
  kitBtn.onclick = kitModal;
  screenEl.appendChild(kitBtn);
  screenEl.appendChild(abandon);
}
function doorMeta(t) {
  return {
    combat: { icon: '⚔️', label: 'Fight', sub: 'something waits in the dark' },
    elite: { icon: '👹', label: 'Elite', sub: 'dangerous — better spoils' },
    event: { icon: '❓', label: 'Strange', sub: 'a story, maybe a price' },
    shop: { icon: '🪙', label: 'Trader', sub: 'spend your gold' },
    rest: { icon: '🛏️', label: 'Camp', sub: 'heal or train' },
    boss: { icon: '🔥', label: 'BOSS', sub: 'you will make camp first (full heal)' },
  }[t];
}

function takeDoor(door) {
  const res = enterDoor(S.run, door);
  if (res.type === 'combat' || res.type === 'elite' || res.type === 'boss') {
    S.combat = buildCombat(S.run, res.encounter, metaBonuses(S.meta));
    if (door.type === 'boss') toast('You make camp at the gate. HP restored.', 1600);
    renderCombat(door.type);
  } else if (res.type === 'shop') renderShop();
  else if (res.type === 'event') renderEvent();
  else if (res.type === 'rest') renderRest();
}

/* ---------------- combat ---------------- */
function renderCombat(kind) {
  S.screen = 'combat';
  clearScreen();
  const c = S.combat;
  const stage = el('div', 'stage');

  const enemiesWrap = el('div', 'enemies');
  const enemyUI = c.enemies.map((e) => {
    const card = el('div', 'enemy');
    card.innerHTML = `<div class="eglyph">${e.glyph}</div><div class="ename">${e.name}</div>`;
    const hp = barEl('hp', e.hp, e.maxHp, e.shield);
    card.appendChild(hp);
    const statuses = el('div', 'statusrow');
    card.appendChild(statuses);
    enemiesWrap.appendChild(card);
    return { card, hp, statuses, entity: e };
  });

  const pp = el('div', 'player-panel');
  const p = c.player;
  pp.innerHTML = `<div class="pglyph">${p.glyph}</div>`;
  const bars = el('div', 'bars');
  bars.innerHTML = `<div class="pname">${p.name} <span class="lvl">lv ${S.run.level}</span></div>`;
  const php = barEl('hp', p.hp, p.maxHp, p.shield);
  const pmana = barEl('mana', p.mana, p.manaMax, 0, false);
  bars.append(php, pmana);
  pp.appendChild(bars);

  const controls = el('div', 'combat-controls');
  const bPause = el('button', 'icon-btn', '⏸');
  const bSpeed = el('button', 'icon-btn', '1×');
  const bAuto = el('button', 'icon-btn', '🤖');
  bPause.onclick = () => { S.paused = !S.paused; bPause.textContent = S.paused ? '▶' : '⏸'; bPause.classList.toggle('on', S.paused); };
  bSpeed.onclick = () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; bSpeed.textContent = S.speed + '×'; bSpeed.classList.toggle('on', S.speed > 1); };
  bAuto.onclick = () => { S.auto = !S.auto; bAuto.classList.toggle('on', S.auto); };
  controls.append(bPause, bSpeed, bAuto);

  const abilitiesWrap = el('div', 'abilities');
  const abilityUI = c.abilities.map(({ def }) => {
    const b = el('button', 'ability');
    b.innerHTML = `<span class="acost">${def.cost}</span><span class="alevel">${def.level > 1 ? 'Lv' + def.level : ''}</span>
      <span class="aicon">${def.icon}</span><span class="aname">${def.name}</span><span class="cdveil" style="height:0%"></span>`;
    b.title = `${def.name} — ${abilityText(def)}`;
    b.onclick = () => {
      const r = c.cast(p, def, 0);
      if (!r.ok) {
        b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
        if (r.reason === 'mana') toast('Not enough mana');
      } else beep('cast');
    };
    abilitiesWrap.appendChild(b);
    return { btn: b, veil: b.querySelector('.cdveil'), def, wasReady: true };
  });

  const potionWrap = el('div');
  stage.append(enemiesWrap, pp, controls, abilitiesWrap, potionWrap);
  screenEl.appendChild(stage);
  renderPotionBar(potionWrap, (idx) => usePotion(idx, c));

  S.combatUI = { enemyUI, abilityUI, php, pmana, potionWrap, kind };
  if (S.meta.stats.runs === 0 && kind === 'combat') {
    toast('You auto-attack. Your job: tap abilities for burst. 1×/2×/3× speed and 🤖 autopilot below.', 4000);
  }
  S.paused = false; S.auto = false; S.acc = 0; S.lastT = performance.now();
  S.raf = requestAnimationFrame(combatLoop);
}

window.addEventListener('keydown', (e) => {
  if (S.screen !== 'combat' || !S.combat) return;
  if (e.target.tagName === 'INPUT') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) {
    const a = S.combatUI?.abilityUI[n - 1];
    if (a) a.btn.click();
  } else if (e.key === ' ') {
    e.preventDefault();
    S.paused = !S.paused;
  }
});

const autoPolicy = autopilot();
function combatLoop(t) {
  const c = S.combat;
  if (!c || S.screen !== 'combat') return;
  try {
    const dt = Math.min(0.25, (t - S.lastT) / 1000);
    S.lastT = t;
    if (!S.paused) {
      S.acc += dt * S.speed;
      while (S.acc >= TICK) {
        if (S.auto) autoPolicy(c);
        c.step(TICK);
        S.acc -= TICK;
      }
      processEvents(c);
      updateCombatDOM();
      if (c.done) { onCombatEnd(); return; }
    }
  } catch (e) {
    console.error('combat loop error', e);
    toast('A hiccup passed. The climb continues.');
  }
  S.raf = requestAnimationFrame(combatLoop);
}

function processEvents(c) {
  for (const ev of c.events) {
    const ui = uiFor(ev.tgt);
    if (ev.kind === 'auto' || ev.kind === 'hit' || ev.kind === 'crit') {
      floatAt(ui?.card, `-${ev.amount}`, ev.kind === 'crit' ? 'crit' : 'hit');
      if (ev.tgt === c.player) shake();
      if (ev.crit) beep('crit');
    } else if (ev.kind === 'heal') floatAt(ui?.card, `+${ev.amount}`, 'heal');
    else if (ev.kind === 'burn') floatAt(ui?.card, `-${ev.amount}`, 'burn');
    else if (ev.kind === 'curse') floatAt(ui?.card, `-${ev.amount}`, 'curse');
    else if (ev.kind === 'shield') floatAt(ui?.card, `🛡${ev.amount}`, 'shield');
    else if (ev.kind === 'thorns') floatAt(ui?.card, `-${ev.amount}`, 'thorns');
    else if (ev.kind === 'death') { if (ui && ui.card) ui.card.classList.add('dead'); beep('die'); }
    else if (ev.kind === 'revive') { toast('The Second Ember flares — you rise!'); }
  }
  c.events.length = 0;
}
function uiFor(entity) {
  const ui = S.combatUI;
  if (!ui) return null;
  if (entity === S.combat.player) return { card: null };
  return ui.enemyUI.find((u) => u.entity === entity) || null;
}
function floatAt(anchor, text, cls) {
  const f = el('div', `float ${cls}`, text);
  const host = anchor || document.body;
  const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  f.style.left = (r.left + r.width / 2 + (Math.random() * 40 - 20)) + 'px';
  f.style.top = (r.top + r.height * 0.3 + (Math.random() * 20 - 10)) + 'px';
  f.style.position = 'fixed';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
function shake() {
  const pp = document.querySelector('.player-panel');
  if (pp) { pp.classList.remove('shake'); void pp.offsetWidth; pp.classList.add('shake'); }
}
function updateCombatDOM() {
  const c = S.combat, ui = S.combatUI;
  ui.enemyUI.forEach((u, i) => {
    const e = u.entity;
    u.hp._fill.style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
    u.hp.querySelector('.barlabel').textContent = `${Math.ceil(e.hp)}/${e.maxHp}${e.shield > 0 ? ` +${Math.round(e.shield)}` : ''}`;
    u.statuses.replaceChildren(...statusChips(e));
    u.card.classList.toggle('target', i === c.enemies.findIndex((x) => x.alive));
    if (!e.alive) u.card.classList.add('dead');
  });
  const p = c.player;
  ui.php._fill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  ui.php.querySelector('.barlabel').textContent = `${Math.ceil(p.hp)}/${p.maxHp}${p.shield > 0 ? ` +${Math.round(p.shield)}` : ''}`;
  ui.pmana._fill.style.width = `${(p.mana / p.manaMax) * 100}%`;
  ui.abilityUI.forEach((a) => {
    const cd = p.cd[a.def.id] || 0;
    const ready = cd <= 0 && p.mana >= a.def.cost;
    a.veil.style.height = cd > 0 ? `${Math.min(100, (cd / Math.max(0.01, a.def.cooldown)) * 100)}%` : '0%';
    a.veil.textContent = cd > 0.2 ? cd.toFixed(1) : '';
    a.btn.disabled = cd > 0 || p.mana < a.def.cost;
    if (ready && !a.wasReady) { a.btn.classList.add('ready-flash'); }
    a.wasReady = ready;
  });
}

function usePotion(idx, c) {
  if (idx == null || !S.run.potions[idx]) return;
  const id = S.run.potions[idx];
  const p = c ? c.player : null;
  const stats = computeStats(S.run, metaBonuses(S.meta));
  if (!c) {
    if (id !== 'heal_potion') { toast('Save that for a fight.'); return; }
    S.run.hpCurrent = Math.min(stats.maxHp, (S.run.hpCurrent ?? stats.maxHp) + 45);
    toast('Cinder Salve applied. +45 HP');
  } else {
    if (id === 'heal_potion') { p.hp = Math.min(p.maxHp, p.hp + 45); floatAt(null, '+45', 'heal'); }
    else if (id === 'ember_flask') {
      const t = c.aliveEnemies()[0];
      if (t) { c.applyDamage(t, 70, p, { noThorns: true, melee: false }); floatAt(uiFor(t)?.card, '-70', 'hit'); }
    }
    else if (id === 'rush_oil') { p.buff = Math.min(10, p.buff + 3); p.buffT = 8; }
    else if (id === 'mana_tonic') { p.mana = Math.min(p.manaMax, p.mana + 50); }
  }
  S.run.potions.splice(idx, 1);
  saveRun();
  if (c) renderPotionBar(S.combatUI.potionWrap, (i2) => usePotion(i2, c));
  else renderTower();
}
function renderPotionBar(host, onPick, allowOutside = false) {
  host.innerHTML = '';
  const wrap = el('div', 'potions');
  S.run.potions.forEach((id, i) => {
    const p = POTIONS[id];
    const b = el('button', 'potion', `${p.icon} ${p.name}`);
    b.title = p.desc;
    b.onclick = () => onPick(i);
    wrap.appendChild(b);
  });
  if (wrap.children.length) host.appendChild(wrap);
}

function onCombatEnd() {
  const c = S.combat;
  setTimeout(() => {
    if (c.win) {
      beep('win');
      const { gold, xp, spoils } = applyVictory(S.run, c, metaBonuses(S.meta));
      S.lastSpoils = spoils;
      toast(`Victory — +${gold} gold, +${xp} xp`, 1800);
      if (S.combatUI.kind === 'boss') {
        toast('Act cleared! Choose a trophy relic.', 2400);
        const owned = new Set(S.run.relics);
        const pool = S.run.rng.shuffle(Object.keys(RELICS).filter((r) => !owned.has(r)));
        S.lastSpoils = pool.slice(0, 3).map((id) => ({ kind: 'relic', id }));
        if (baseActOf(S.run) === 3 && !S.celebrated) {
          S.celebrated = true;
          modal('The tower bows to you.', [
            el('p', null, 'Act 3 has fallen. Below it, the tower repeats itself — every loop, foes gain +25% HP and +18% attack, and embers scale with the depth.'),
            el('p', null, 'There is no top floor. There is only your Forge.'),
          ], [['Keep climbing', null, 'primary']]);
        }
      }
      saveRun();
      if (S.run.pendingBoons && S.run.pendingBoons.length) renderLevelUp();
      else renderSpoils();
    } else {
      endRun(true);
    }
  }, 700);
}

/* ---------------- rewards ---------------- */
function renderSpoils() {
  S.screen = 'spoils';
  clearScreen();
  screenEl.appendChild(el('h2', 'panel-title', 'Spoils of the fight'));
  screenEl.appendChild(el('p', 'panel-note', 'take one — or leave it be'));
  const grid = el('div', 'cards');
  for (const offer of S.lastSpoils) {
    const card = spoilCard(offer);
    card.onclick = () => { takeSpoil(S.run, offer); toast('Taken.'); afterSpoils(); };
    grid.appendChild(card);
  }
  screenEl.appendChild(grid);
  const skip = el('button', 'btn ghost', 'Leave it');
  skip.onclick = () => afterSpoils();
  screenEl.appendChild(skip);
}
function spoilCard(offer) {
  if (offer.kind === 'ability') {
    const a = ABILITIES[offer.id];
    const card = el('button', `card rarity-${a.rarity}`);
    card.innerHTML = `<span class="cicon">${a.icon}</span>${rarityTag(a.rarity)}<h4>${a.name}</h4>
      <p class="cdesc">${a.cost} mana · ${a.cooldown}s · ${abilityText(a)}</p>
      <div class="flavor">${a.flavor}</div>`;
    return card;
  }
  if (offer.kind === 'relic') {
    const r = RELICS[offer.id];
    const card = el('button', 'card');
    card.innerHTML = `<span class="cicon">${r.icon}</span><h4>${r.name}</h4><p class="cdesc">${r.desc}</p>`;
    return card;
  }
  if (offer.kind === 'potion') {
    const p = POTIONS[offer.id];
    const card = el('button', 'card');
    card.innerHTML = `<span class="cicon">${p.icon}</span><h4>${p.name}</h4><p class="cdesc">${p.desc}</p>`;
    return card;
  }
  const card = el('button', 'card');
  card.innerHTML = `<span class="cicon">🪙</span><h4>${offer.amount} gold</h4>`;
  return card;
}
function afterSpoils() {
  S.lastSpoils = null;
  finishFloor(S.run);
  saveRun();
  renderTower();
}

function renderLevelUp() {
  S.screen = 'levelup';
  clearScreen();
  screenEl.appendChild(el('h2', 'panel-title', `Level ${S.run.level} — the tower reshapes you`));
  const grid = el('div', 'cards');
  for (const boon of S.run.pendingBoons) {
    const card = el('button', 'card');
    card.innerHTML = `<h4>${boon.name}</h4><p class="cdesc">${boon.desc}</p>`;
    card.onclick = () => {
      chooseBoon(S.run, boon);
      saveRun();
      if (S.run.pendingBoons && S.run.pendingBoons.length) renderLevelUp();
      else if (S.lastSpoils) renderSpoils();
      else renderTower();
    };
    grid.appendChild(card);
  }
  screenEl.appendChild(grid);
}

/* ---------------- shop / event / rest ---------------- */
function renderShop() {
  S.screen = 'shop';
  clearScreen();
  screenEl.appendChild(el('h2', 'panel-title', '🪙 The Trader'));
  screenEl.appendChild(el('p', 'panel-note', `your gold: <b style="color:var(--gold)">${S.run.gold}</b>`));
  const grid = el('div', 'cards');
  for (const item of S.run.shop) {
    let card;
    if (item.kind === 'ability') {
      const a = ABILITIES[item.id];
      card = el('button', `card rarity-${a.rarity}`);
      card.innerHTML = `<span class="price">${item.price}g</span><span class="cicon">${a.icon}</span>${rarityTag(a.rarity)}
        <h4>${a.name}</h4><p class="cdesc">${a.cost} mana · ${a.cooldown}s · ${abilityText(a)}</p>`;
    } else if (item.kind === 'relic') {
      const r = RELICS[item.id];
      card = el('button', 'card');
      card.innerHTML = `<span class="price">${item.price}g</span><span class="cicon">${r.icon}</span><h4>${r.name}</h4><p class="cdesc">${r.desc}</p>`;
    } else if (item.kind === 'potion') {
      const p = POTIONS[item.id];
      card = el('button', 'card');
      card.innerHTML = `<span class="price">${item.price}g</span><span class="cicon">${p.icon}</span><h4>${p.name}</h4><p class="cdesc">${p.desc}</p>`;
    } else {
      card = el('button', 'card');
      card.innerHTML = `<span class="price">${item.price}g</span><span class="cicon">🛏️</span><h4>Heal 50%</h4><p class="cdesc">bandages, broth, stubbornness</p>`;
    }
    card.onclick = () => {
      const r = buyItem(S.run, item);
      if (r.ok) { beep('coin'); toast('Bought.'); renderShop(); }
      else toast(r.reason === 'gold' ? 'Not enough gold' : r.reason === 'owned' ? 'Already yours' : 'No room for more potions');
    };
    grid.appendChild(card);
  }
  screenEl.appendChild(grid);

  screenEl.appendChild(el('div', 'section-head', 'Hone an ability (gold)'));
  const upGrid = el('div', 'forge-grid');
  for (const a of S.run.abilities) {
    const cost = upgradeCost(a);
    const b = el('button', 'btn forge-item');
    const def = abilityDef(a);
    b.innerHTML = `<span class="cicon">${def.icon}</span><span class="finfo"><h4>${def.name} <span class="lvl">Lv${a.level}${a.level < 3 ? ' → ' + (a.level + 1) : ' (max)'}</span></h4>
      <p class="fdesc">${abilityText(def)}</p>${a.level < 3 ? `<span class="fcost">${cost}g</span>` : ''}</span>`;
    b.onclick = () => {
      const r = upgradeAbility(S.run, a.id, cost);
      if (r.ok) { beep('coin'); toast('Sharpened.'); renderShop(); }
      else if (r.reason === 'gold') toast('Not enough gold');
    };
    upGrid.appendChild(b);
  }
  screenEl.appendChild(upGrid);

  const leave = el('button', 'btn primary', 'Back to the stair');
  leave.onclick = () => { finishFloor(S.run); saveRun(); renderTower(); };
  screenEl.appendChild(leave);
}

function renderEvent() {
  S.screen = 'event';
  clearScreen();
  const ev = S.run.event;
  const box = el('div', 'event-box');
  box.innerHTML = `<div class="eglyph">${ev.glyph}</div><h3>${ev.title}</h3><p>${ev.text}</p>`;
  screenEl.appendChild(box);
  for (const ch of ev.choices) {
    const b = el('button', 'btn', ch.label);
    b.onclick = () => {
      const res = resolveEvent(S.run, ch, metaBonuses(S.meta));
      toast(res.notes.length ? res.notes.join(' · ') : 'Nothing changes.', 2600);
      finishFloor(S.run);
      saveRun();
      renderTower();
    };
    screenEl.appendChild(b);
  }
}

function renderRest() {
  S.screen = 'rest';
  clearScreen();
  screenEl.appendChild(el('h2', 'panel-title', '🛏️ Camp'));
  screenEl.appendChild(el('p', 'panel-note', 'the tower does not sleep, but you can'));
  const grid = el('div', 'cards');
  for (const opt of [{ id: 'sleep', name: 'Sleep', desc: 'Heal 35% of max HP' }, { id: 'train', name: 'Train', desc: 'Upgrade a random ability' }]) {
    const card = el('button', 'card');
    card.innerHTML = `<h4>${opt.name}</h4><p class="cdesc">${opt.desc}</p>`;
    card.onclick = () => {
      const res = applyRest(S.run, opt.id);
      toast(res.note, 2600);
      finishFloor(S.run);
      saveRun();
      renderTower();
    };
    grid.appendChild(card);
  }
  screenEl.appendChild(grid);
}

/* ---------------- death ---------------- */
function endRun(died) {
  cancelAnimationFrame(S.raf);
  const summary = runSummary(S.run);
  const bonuses = metaBonuses(S.meta);
  const result = applyRunResult(S.meta, summary, bonuses);
  saveMeta();
  S.run = null;
  saveJSON('run', null);
  S.screen = 'death';
  clearScreen();
  screenEl.appendChild(el('h2', 'panel-title', died ? 'The tower keeps you.' : 'You step back down.'));
  screenEl.appendChild(el('div', 'death-embers', `+${result.embers} embers`));
  const lines = [
    ['Reached', `floor ${summary.floor} (act ${summary.act})`],
    ['Foes felled', summary.kills],
    ['Bosses', summary.bosses],
    ['Acts cleared', summary.actsCleared],
  ];
  for (const [k, v] of lines) {
    const l = el('div', 'statline');
    l.innerHTML = `<span>${k}</span><b>${v}</b>`;
    screenEl.appendChild(l);
  }
  for (const a of result.newAchievements) {
    const l = el('div', 'statline');
    l.innerHTML = `<span>🏆 ${a.name}</span><b class="reward" style="color:var(--gold)">+${a.reward} embers</b>`;
    screenEl.appendChild(l);
  }
  const btns = el('div', 'title-buttons');
  const bForge = el('button', 'btn primary', '⚒ Spend embers at the Forge');
  bForge.onclick = renderForge;
  const bAgain = el('button', 'btn', '🗼 Climb again');
  bAgain.onclick = renderClasses;
  btns.append(bForge, bAgain);
  if (summary.seed != null) {
    const bReplay = el('button', 'btn ghost', `↻ Retry this seed`);
    bReplay.onclick = () => beginRun(summary.cls, summary.seed);
    btns.append(bReplay);
  }
  screenEl.appendChild(btns);
}

/* ---------------- forge ---------------- */
function renderForge() {
  S.screen = 'forge';
  clearScreen();
  const m = S.meta;
  screenEl.appendChild(el('h2', 'panel-title', '⚒ The Forge'));
  const stats = el('div', 'forge-stats');
  for (const [k, v] of [
    ['Embers', m.embers],
    ['Cinders', m.cinders],
    ['Idle /sec', idleRate(m).toFixed(2)],
    ['Best floor', m.stats.bestFloor || 0],
    ['Ember mult', '×' + cinderMult(m).toFixed(2)],
  ]) {
    const s = el('div', 'forge-stat');
    s.innerHTML = `<div class="v">${v}</div><div class="k">${k}</div>`;
    stats.appendChild(s);
  }
  screenEl.appendChild(stats);

  screenEl.appendChild(el('div', 'section-head', 'Permanent upgrades (survive a Reforge)'));
  const grid = el('div', 'forge-grid');
  for (const up of FORGE) {
    const lvl = forgeLevel(m, up.id);
    const cost = forgeCost(up, lvl);
    const b = el('button', 'btn forge-item');
    b.innerHTML = `<span class="finfo"><h4>${up.name} <span class="lvl">${lvl}/${up.max}</span></h4>
      <p class="fdesc">${up.desc}</p>${lvl < up.max ? `<span class="fcost">🔥 ${cost}</span>` : '<span class="lvl">maxed</span>'}</span>`;
    b.onclick = () => {
      const r = buyForge(m, up.id);
      if (r.ok) { beep('coin'); saveMeta(); renderForge(); }
      else toast(r.reason === 'embers' ? 'Not enough embers' : 'Maxed out');
    };
    grid.appendChild(b);
  }
  screenEl.appendChild(grid);

  const pend = pendingCinders(m);
  const rb = el('button', 'btn' + (pend > 0 ? ' primary' : ''),
    `♻ Reforge — reset upgrades, gain ${pend} Cinders ${pend > 0 ? `(next: ×${(1 + 0.3 * (m.cinders + pend)).toFixed(2)} embers)` : '(invest more embers first)'}`);
  rb.onclick = () => {
    modal('Reforge?', [el('p', null, 'All Forge upgrades reset. Your embers stay. Cinders multiply every ember you ever earn, forever.')], [
      ['Reforge', () => { const r = reforge(m); if (r.ok) { toast(`+${r.gained} Cinders.`); saveMeta(); renderForge(); } }, 'danger'],
      ['Not yet'],
    ]);
  };
  screenEl.appendChild(rb);

  screenEl.appendChild(el('div', 'section-head', 'Achievements'));
  for (const a of ACHIEVEMENTS) {
    const done = !!m.achievements[a.id];
    const row = el('div', 'ach' + (done ? ' done' : ''));
    row.innerHTML = `<span>${done ? '✓' : '○'} ${a.name} — <span class="muted">${a.desc}</span></span><span class="reward">+${a.reward}</span>`;
    screenEl.appendChild(row);
  }

  const back = el('button', 'btn ghost', '← back');
  back.onclick = S.run ? renderTower : renderTitle;
  screenEl.appendChild(back);
}

/* ---------------- menu / help ---------------- */
function helpModal() {
  modal('How to play', [
    el('p', null, `<b>The climb.</b> Each floor offers doors — fight, trade, rest, or something strange. Pick one. Death ends the run, but embers are always banked.`),
    el('p', null, `<b>Combat is real-time.</b> You and your foes auto-attack. Your abilities are the buttons: they cost mana and have cooldowns. Tap them. Burn and curse tick over time; shields soak hits; camps and salves heal.`),
    el('p', null, `<b>The Forge.</b> Embers buy permanent upgrades and idle income — the Forge earns embers even while you sleep. Reforge resets upgrades for Cinders, a permanent multiplier. That's the "incremental" part.`),
    el('p', null, `<b>Controls.</b> ⏸ pause · 1×/2×/3× speed · 🤖 autopilot (watch, or learn). Boss floors always start with a camp (full heal).`),
  ], [['Got it']]);
}
function achievementsModal() {
  const rows = [];
  const st = S.meta.stats || {};
  const statsLine = el('p', 'muted-small',
    `Runs: ${st.runs || 0} · Best floor: ${st.bestFloor || 0} · Bosses: ${st.bossKills || 0} · Reforges: ${st.reforges || 0} · Cinders: ${S.meta.cinders || 0}`);
  rows.push(statsLine);
  for (const a of ACHIEVEMENTS) {
    const got = !!S.meta.achievements[a.id];
    const row = el('div', 'ach-row' + (got ? ' got' : ''));
    row.innerHTML = `<b>${got ? '🔥 ' : '🔒 '}${a.name}</b> — ${a.desc} <span class="ach-reward">+${a.reward} embers</span>`;
    rows.push(row);
  }
  modal('Achievements & legacy', rows, [['Close']]);
}

function menuModal() {
  const acts = [];
  if (S.run) acts.push(['Abandon run (bank embers)', () => endRun(false), 'danger']);
  acts.push(['Achievements & legacy', achievementsModal]);
  acts.push(['How to play', helpModal]);
  acts.push(['Reset ALL progress', () => {
    modal('Reset everything?', [el('p', null, 'Embers, Forge, achievements, everything. This cannot be undone.')], [
      ['Reset', () => { clearAll(); location.reload(); }, 'danger'], ['Cancel'],
    ]);
  }, 'ghost']);
  acts.push(['Close']);
  modal('Menu', [], acts);
}

/* ---------------- boot ---------------- */
window.__S = S; window.__renderTower = renderTower; window.__renderTitle = renderTitle; window.__screenEl = screenEl; window.__beginRun = beginRun; window.__endRun = endRun; window.__onCombatEnd = onCombatEnd; // debug hooks
function boot() {
  S.meta = loadJSON('meta') || defaultMeta();
  const idle = collectIdle(S.meta, Date.now());
  if (idle.gain > 0) S.pendingIdle = idle;
  saveMeta();
  $('#btn-menu').onclick = menuModal;
  $('#btn-sound').onclick = () => {
    S.meta.settings.sound = !S.meta.settings.sound;
    $('#btn-sound').textContent = S.meta.settings.sound ? '🔊' : '🔇';
    saveMeta();
  };
  $('#btn-sound').textContent = S.meta.settings.sound ? '🔊' : '🔇';
  window.addEventListener('beforeunload', saveRun);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveRun(); });

  const savedRun = loadJSON('run');
  if (savedRun) {
    S.run = deserializeRun(savedRun);
    if (savedRun.combat) {
      S.combat = deserializeCombat(savedRun.combat, S.run);
      renderCombat('combat');
      toast('Fight resumed.', 1500);
      return;
    }
    renderTower();
    if (S.pendingIdle) { /* shown over tower */ }
    return;
  }
  renderTitle();
}
boot();
