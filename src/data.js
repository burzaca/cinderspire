// CINDERSPIRE content — all game data lives here. Numbers are tuned against
// the headless balance sim (scripts/simulate.js); change data, re-run sim.

export const CLASSES = {
  emberwright: {
    name: 'Emberwright', glyph: '🔥', tag: 'Burn them bright.',
    desc: 'Firecaller. Weak to face, strong over time — burns stack and amplify.',
    stats: { maxHp: 75, atk: 10, atkSpeed: 1.15, armor: 0, manaRegen: 13, crit: 0.05 },
    start: ['cinder_lance', 'ember_wave', 'kindling'],
    unlockCost: 0,
  },
  ironsoul: {
    name: 'Ironsoul', glyph: '⚙️', tag: 'Outlast, then break them.',
    desc: 'Armored vanguard. Shields, thorns and heavy single hits.',
    stats: { maxHp: 100, atk: 11, atkSpeed: 0.8, armor: 2, manaRegen: 9, crit: 0.05 },
    start: ['iron_jab', 'bulwark', 'riposte'],
    unlockCost: 150,
  },
  gravetongue: {
    name: 'Gravetongue', glyph: '💀', tag: 'Everything feeds the grave.',
    desc: 'Cursebearer. Curses, lifesteal and slow attrition.',
    stats: { maxHp: 85, atk: 9, atkSpeed: 1.0, armor: 0, manaRegen: 11, crit: 0.05, lifesteal: 0.10 },
    start: ['grave_bite', 'hex', 'wither'],
    unlockCost: 250,
  },
};

// power = damage as multiple of attack. Costs are mana; cooldowns seconds.
export const ABILITIES = {
  // ---- Emberwright ----
  cinder_lance: { name: 'Cinder Lance', cls: 'emberwright', cost: 15, cooldown: 0, power: 1.8, rarity: 'common', icon: '🔺', flavor: 'A spear of cooled slag.' },
  ember_wave: { name: 'Ember Wave', cls: 'emberwright', cost: 30, cooldown: 4, power: 1.1, aoe: true, burn: 4, rarity: 'common', icon: '🌊', flavor: 'Heat does not knock.' },
  wildfire: { name: 'Wildfire', cls: 'emberwright', cost: 25, cooldown: 6, burn: 9, selfDamage: 6, rarity: 'uncommon', icon: '🔥', flavor: 'Fire eats whoever feeds it.' },
  kindling: { name: 'Kindling', cls: 'emberwright', cost: 25, cooldown: 12, burnAmp: 0.5, buff: 1, rarity: 'uncommon', icon: '🪵', flavor: 'Everything burns better.' },
  sear: { name: 'Sear', cls: 'emberwright', cost: 20, cooldown: 8, slow: 2, weaken: 1, rarity: 'uncommon', icon: '♨️', flavor: 'Soft knees, soft steel.' },
  ash_shield: { name: 'Ash Shield', cls: 'emberwright', cost: 20, cooldown: 8, shield: 22, rarity: 'uncommon', icon: '🌫️', flavor: 'Smoke you can hide behind.' },
  cinder_rain: { name: 'Cinder Rain', cls: 'emberwright', cost: 40, cooldown: 10, power: 0.9, aoe: true, burn: 4, rarity: 'rare', icon: '🌠', flavor: 'The sky owes you nothing.' },
  pyroclasm: { name: 'Pyroclasm', cls: 'emberwright', cost: 50, cooldown: 12, power: 2.6, aoe: true, burn: 5, rarity: 'rare', icon: '💥', flavor: 'The mountain clears its throat.' },

  // ---- Ironsoul ----
  iron_jab: { name: 'Iron Jab', cls: 'ironsoul', cost: 12, cooldown: 0, power: 1.5, rarity: 'common', icon: '👊', flavor: 'Fundamentals.' },
  bulwark: { name: 'Bulwark', cls: 'ironsoul', cost: 20, cooldown: 6, shield: 30, rarity: 'common', icon: '🛡️', flavor: 'A door that fights back.' },
  riposte: { name: 'Riposte', cls: 'ironsoul', cost: 20, cooldown: 10, thornsGain: 5, shield: 10, rarity: 'uncommon', icon: '🌵', flavor: 'Hug the hedgehog.' },
  shield_bash: { name: 'Shield Bash', cls: 'ironsoul', cost: 25, cooldown: 6, power: 1.4, weaken: 2, rarity: 'uncommon', icon: '🔨', flavor: 'Diplomacy, briefly.' },
  steadfast: { name: 'Steadfast', cls: 'ironsoul', cost: 25, cooldown: 12, buff: 3, rarity: 'uncommon', icon: '⚓', flavor: 'Anchored in cinders.' },
  hammer_down: { name: 'Hammer Down', cls: 'ironsoul', cost: 30, cooldown: 7, power: 2.8, rarity: 'rare', icon: '🔨', flavor: 'One honest blow.' },
  taunt_slam: { name: 'Taunt Slam', cls: 'ironsoul', cost: 35, cooldown: 9, power: 1.2, aoe: true, weaken: 1, rarity: 'rare', icon: '📢', flavor: 'Look at me. All of you.' },

  // ---- Gravetongue ----
  grave_bite: { name: 'Grave Bite', cls: 'gravetongue', cost: 12, cooldown: 0, power: 1.4, heal: 4, rarity: 'common', icon: '🪦', flavor: 'Small bite, borrowed life.' },
  hex: { name: 'Hex', cls: 'gravetongue', cost: 20, cooldown: 3, curse: 6, rarity: 'common', icon: '🕸️', flavor: 'It starts as a hum.' },
  wither: { name: 'Wither', cls: 'gravetongue', cost: 20, cooldown: 8, weaken: 3, curse: 2, rarity: 'uncommon', icon: '🥀', flavor: 'Steel rusts faster near me.' },
  soul_sip: { name: 'Soul Sip', cls: 'gravetongue', cost: 30, cooldown: 6, power: 1.8, heal: 14, rarity: 'uncommon', icon: '🥤', flavor: 'Slurp, respectfully.' },
  leech_ward: { name: 'Leech Ward', cls: 'gravetongue', cost: 25, cooldown: 9, shield: 18, heal: 10, rarity: 'uncommon', icon: '🩸', flavor: 'Borrowed skin, returned later.' },
  doom_bloom: { name: 'Doom Bloom', cls: 'gravetongue', cost: 45, cooldown: 12, curse: 14, rarity: 'rare', icon: '☠️', flavor: 'It was always going to end this way.' },

  // ---- common pool (any class can find these) ----
  swift_cut: { name: 'Swift Cut', cls: null, cost: 15, cooldown: 2, power: 1.2, rarity: 'common', icon: '🗡️', flavor: 'Quick, rude, effective.' },
  focus: { name: 'Focus', cls: null, cost: 0, cooldown: 10, mana: 35, rarity: 'common', icon: '🧘', flavor: 'Breathe. Channel. Show off.' },
  siphon: { name: 'Siphon', cls: null, cost: 10, cooldown: 8, power: 0.8, heal: 8, rarity: 'common', icon: '🧃', flavor: 'Two-way street.' },
  chill: { name: 'Chill', cls: null, cost: 15, cooldown: 5, slow: 1, weaken: 1, rarity: 'common', icon: '❄️', flavor: 'Cold feet, literally.' },
  ember_bolt: { name: 'Ember Bolt', cls: null, cost: 20, cooldown: 4, power: 1.0, burn: 4, rarity: 'uncommon', icon: '✨', flavor: 'Borrowed fire, no refund.' },
  second_wind: { name: 'Second Wind', cls: null, cost: 25, cooldown: 12, heal: 30, rarity: 'uncommon', icon: '🍃', flavor: 'One more, then none.' },
  thorn_mail: { name: 'Thorn Mail', cls: null, cost: 20, cooldown: 12, thornsGain: 4, rarity: 'uncommon', icon: '🌿', flavor: 'Do not hug me.' },
  twin_strike: { name: 'Twin Strike', cls: null, cost: 25, cooldown: 4, power: 0.9, hits: 3, rarity: 'uncommon', icon: '⚔️', flavor: 'One for each hand.' },
  surge: { name: 'Surge', cls: null, cost: 20, cooldown: 15, cdr: 0.12, rarity: 'uncommon', icon: '⚡', flavor: 'Time, but mean.' },
  rally: { name: 'Rally', cls: null, cost: 30, cooldown: 14, buff: 3, rarity: 'rare', icon: '🥁', flavor: 'Drums before the wall.' },
  execute: { name: 'Execute', cls: null, cost: 30, cooldown: 8, power: 1.2, executePower: 3.2, executeBelow: 0.3, rarity: 'rare', icon: '🪓', flavor: 'Finish the sentence.' },
};

export const RARITY_WEIGHT = { common: 60, uncommon: 30, rare: 10 };

export const RELICS = {
  ember_heart: { name: 'Ember Heart', icon: '🧡', desc: '+15 max HP', stats: { maxHp: 15 } },
  hot_coals: { name: 'Hot Coals', icon: '🪨', desc: '+2 attack', stats: { atk: 2 } },
  bellows_charm: { name: 'Bellows Charm', icon: '💨', desc: '+0.10 attack speed', stats: { atkSpeed: 0.1 } },
  slag_plate: { name: 'Slag Plate', icon: '🛡️', desc: '+2 armor', stats: { armor: 2 } },
  mana_geode: { name: 'Mana Geode', icon: '💎', desc: '+4 mana regen', stats: { manaRegen: 4 } },
  lucky_coin: { name: 'Lucky Coin', icon: '🪙', desc: '+6 luck (cheaper shops, better spoils)', stats: { luck: 6 } },
  vampire_fang: { name: 'Vampire Fang', icon: '🦇', desc: '+8% lifesteal', stats: { lifesteal: 0.08 } },
  cinder_prism: { name: 'Cinder Prism', icon: '🔮', desc: '+15% crit chance', stats: { crit: 0.15 } },
  thorn_ring: { name: 'Thorn Ring', icon: '💍', desc: '+3 thorns', stats: { thorns: 3 } },
  slow_burn: { name: 'Slow Burn', icon: '🕯️', desc: '+25% burn damage', stats: { burnAmp: 0.25 } },
  grave_sigil: { name: 'Grave Sigil', icon: '⚰️', desc: '+25% curse damage', stats: { curseAmp: 0.25 } },
  war_drums: { name: 'War Drums', icon: '🥁', desc: '+0.15 attack speed', stats: { atkSpeed: 0.15 } },
  gold_purse: { name: 'Gold Purse', icon: '👛', desc: '+30% gold from fights', stats: { goldBonus: 0.3 } },
  second_ember: { name: 'Second Ember', icon: '🕏', desc: 'Once per fight, rise again at 35% HP', stats: { revives: 1 } },
};

// Enemy abilities reuse the ability effect schema (targets flip automatically).
export const ENEMY_ABILITIES = {
  spark_burn: { id: 'spark_burn', name: 'Spark', cost: 20, cooldown: 6, burn: 4, ai: 0.8, icon: '✨' },
  slam: { id: 'slam', name: 'Slam', cost: 30, cooldown: 6, power: 1.3, ai: 0.9, icon: '💢' },
  chime: { id: 'chime', name: 'Chime', cost: 25, cooldown: 7, weaken: 2, ai: 0.7, icon: '🔔' },
  shieldup: { id: 'shieldup', name: 'Harden', cost: 30, cooldown: 8, shield: 25, ai: 0.8, icon: '🧱' },
  gust: { id: 'gust', name: 'Gust', cost: 25, cooldown: 8, slow: 2, ai: 0.7, icon: '🌬️' },
  hexing: { id: 'hexing', name: 'Hexing', cost: 30, cooldown: 8, curse: 6, ai: 0.8, icon: '🕸️' },
  warcry: { id: 'warcry', name: 'War Cry', cost: 35, cooldown: 12, buff: 3, ai: 0.85, icon: '📯' },
  mending: { id: 'mending', name: 'Mending', cost: 30, cooldown: 10, heal: 30, needsLowHp: true, ai: 0.9, icon: '🩹' },
};

export const ENEMIES = {
  // Act I — the Smoldering Stairs
  ash_rat: { name: 'Ash Rat', act: 1, glyph: '🐀', stats: { maxHp: 40, atk: 4, atkSpeed: 1.2 }, xp: 6, gold: 8 },
  cinderling: { name: 'Cinderling', act: 1, glyph: '👺', stats: { maxHp: 55, atk: 5, atkSpeed: 1.0, armor: 1 }, abilities: ['spark_burn'], xp: 9, gold: 10 },
  wisp: { name: 'Wisp', act: 1, glyph: '💠', stats: { maxHp: 45, atk: 4.5, atkSpeed: 1.4, crit: 0.12 }, xp: 8, gold: 9 },
  ember_hound: { name: 'Ember Hound', act: 1, glyph: '🐕‍🦺', elite: true, stats: { maxHp: 110, atk: 6.5, atkSpeed: 1.3 }, abilities: ['spark_burn'], xp: 20, gold: 28 },
  slagling: { name: 'Slagling', act: 1, glyph: '🗿', elite: true, stats: { maxHp: 120, atk: 6, atkSpeed: 0.9, armor: 3 }, abilities: ['slam'], xp: 20, gold: 28 },
  cinder_warden: { name: 'The Cinder Warden', act: 1, glyph: '🔥', boss: true, stats: { maxHp: 240, atk: 7, atkSpeed: 0.9, armor: 3 }, abilities: ['slam', 'spark_burn', 'warcry'], xp: 60, gold: 90 },

  // Act II — the Hollow Forge
  rust_golem: { name: 'Rust Golem', act: 2, glyph: '🤖', stats: { maxHp: 95, atk: 7, atkSpeed: 0.7, armor: 4 }, xp: 14, gold: 16 },
  hollow_adept: { name: 'Hollow Adept', act: 2, glyph: '🧙', stats: { maxHp: 75, atk: 6.5, atkSpeed: 1.1 }, abilities: ['chime'], xp: 13, gold: 15 },
  chime_wraith: { name: 'Chime Wraith', act: 2, glyph: '👻', stats: { maxHp: 70, atk: 7.5, atkSpeed: 1.3, crit: 0.15 }, abilities: ['chime'], xp: 13, gold: 15 },
  slag_brute: { name: 'Slag Brute', act: 2, glyph: '🦣', elite: true, stats: { maxHp: 170, atk: 9, atkSpeed: 0.8, armor: 5 }, abilities: ['slam'], xp: 34, gold: 45 },
  chain_warden: { name: 'Chain Warden', act: 2, glyph: '⛓️', elite: true, stats: { maxHp: 155, atk: 8, atkSpeed: 1.0, armor: 4 }, abilities: ['shieldup', 'slam'], xp: 34, gold: 45 },
  hollow_smith: { name: 'The Hollow Smith', act: 2, glyph: '🔨', boss: true, stats: { maxHp: 520, atk: 10, atkSpeed: 0.85, armor: 5 }, abilities: ['slam', 'warcry', 'mending'], xp: 90, gold: 150 },

  // Act III — the Pale Choir
  pale_acolyte: { name: 'Pale Acolyte', act: 3, glyph: '🕯️', stats: { maxHp: 110, atk: 9, atkSpeed: 1.0 }, abilities: ['hexing'], xp: 22, gold: 24 },
  grave_moth: { name: 'Grave Moth', act: 3, glyph: '🦋', stats: { maxHp: 95, atk: 10, atkSpeed: 1.4 }, xp: 21, gold: 22 },
  choir_voice: { name: 'Choir Voice', act: 3, glyph: '🎻', stats: { maxHp: 105, atk: 8.5, atkSpeed: 1.2 }, abilities: ['gust'], xp: 22, gold: 24 },
  pale_knight: { name: 'Pale Knight', act: 3, glyph: '🛡️', elite: true, stats: { maxHp: 240, atk: 11, atkSpeed: 0.9, armor: 6 }, abilities: ['shieldup', 'slam'], xp: 50, gold: 70 },
  frost_herald: { name: 'Frost Herald', act: 3, glyph: '🧊', elite: true, stats: { maxHp: 220, atk: 10, atkSpeed: 1.1 }, abilities: ['gust', 'chime'], xp: 50, gold: 70 },
  pale_choir: { name: 'The Pale Choir', act: 3, glyph: '🎭', boss: true, stats: { maxHp: 800, atk: 12, atkSpeed: 1.0, armor: 5, lifesteal: 0.1 }, abilities: ['hexing', 'gust', 'warcry', 'mending'], xp: 140, gold: 260 },
};

export const ACT_NAMES = {
  1: 'The Smoldering Stairs',
  2: 'The Hollow Forge',
  3: 'The Pale Choir',
};

export const FLOORS_PER_ACT = 8; // floor 8 of each act is the boss
export const TOTAL_ACTS = 3;

export const POTIONS = {
  heal_potion: { name: 'Cinder Salve', icon: '🧴', desc: 'Heal 45 HP', price: 28 },
  ember_flask: { name: 'Ember Flask', icon: '🫙', desc: 'Deal 70 damage instantly', price: 32 },
  rush_oil: { name: 'Rush Oil', icon: '🛢️', desc: '+3 attack speed buff (8s)', price: 30 },
  mana_tonic: { name: 'Mana Tonic', icon: '🍵', desc: '+50 mana now', price: 26 },
};

export const EVENTS = [
  {
    id: 'forge_shrine', title: 'A Cold Shrine', glyph: '⛩️',
    text: 'A hammer rests on an anvil, cold for years. Something here still listens.',
    choices: [
      { label: 'Strike the anvil (+3 attack)', outcome: { stat: { atk: 3 } } },
      { label: 'Pray (heal 30)', outcome: { hp: 30 } },
      { label: 'Leave', outcome: {} },
    ],
  },
  {
    id: 'merchant_ghost', title: 'The Ghost Merchant', glyph: '🏮',
    text: 'A translucent trader offers a relic for a memory. Yours, not mine.',
    choices: [
      { label: 'Trade a memory (gain a relic, lose 10 max HP)', outcome: { relic: true, stat: { maxHp: -10 } } },
      { label: 'Refuse politely', outcome: {} },
    ],
  },
  {
    id: 'ember_pool', title: 'Pool of Embers', glyph: '♨️',
    text: 'Molten light pools in a cracked basin. It hums when you lean close.',
    choices: [
      { label: 'Drink (+4 mana regen, lose 8 HP)', outcome: { stat: { manaRegen: 4 }, hp: -8 } },
      { label: 'Bottle some (+60 gold)', outcome: { gold: 60 } },
      { label: 'Back away slowly', outcome: {} },
    ],
  },
  {
    id: 'bone_library', title: 'Bone Library', glyph: '📚',
    text: 'Books bound in something pale. One of them is open to your name.',
    choices: [
      { label: 'Read (gain an ability)', outcome: { ability: true } },
      { label: 'Burn it for warmth (heal full)', outcome: { hp: 999 } },
      { label: 'Shelve it and go', outcome: {} },
    ],
  },
  {
    id: 'gambler', title: 'The Cinder Wager', glyph: '🎲',
    text: 'A figure made of ash shuffles three stones. "Double or nothing, climber."',
    choices: [
      { label: 'Wager 50 gold (50%: +120 gold)', outcome: { gamble: { stake: 50, win: 120, p: 0.5 } } },
      { label: 'Walk away', outcome: {} },
    ],
  },
  {
    id: 'smith_stump', title: 'Stump Smith', glyph: '⚒️',
    text: 'A smith with no forge sharpens things anyway. She seems confident.',
    choices: [
      { label: 'Let her work (upgrade a random ability)', outcome: { upgradeRandom: true } },
      { label: 'Pay for the best one instead (60 gold)', outcome: { upgradeChosen: true, cost: 60 } },
      { label: 'Not today', outcome: {} },
    ],
  },
  {
    id: 'nursing_ash', title: 'Ash Nursery', glyph: '🌱',
    text: 'Tiny plants grow in the cinder. A child guards them with a spoon.',
    choices: [
      { label: 'Help tend them (+10 max HP)', outcome: { stat: { maxHp: 10 } } },
      { label: 'Trade soup (heal 40, +10 gold)', outcome: { hp: 40, gold: 10 } },
      { label: 'Tip the spoon and go', outcome: {} },
    ],
  },
  {
    id: 'dark_stair', title: 'The Dark Stair', glyph: '🕳️',
    text: 'The stair down is darker than the tower should allow. Something counts behind you.',
    choices: [
      { label: 'Descend blind (+80 gold, lose 12 HP)', outcome: { gold: 80, hp: -12 } },
      { label: 'Light a torch (nothing happens, you feel brave)', outcome: { buff: 1 } },
    ],
  },
  {
    id: 'choir_lesson', title: 'A Choir Lesson', glyph: '🎼',
    text: 'Pale figures hum in rows. They make room for you without looking.',
    choices: [
      { label: 'Sing (+2 attack, lose 10 max HP)', outcome: { stat: { atk: 2 }, statHpCost: true, hp: -10 } },
      { label: 'Cover your ears', outcome: {} },
    ],
  },
  {
    id: 'found_forge', title: 'A Working Forge', glyph: '🔥',
    text: 'Somebody left this forge running. The coals are still red, still patient.',
    choices: [
      { label: 'Forge armor (+2 armor)', outcome: { stat: { armor: 2 } } },
      { label: 'Forge a blade (+0.1 attack speed)', outcome: { stat: { atkSpeed: 0.1 } } },
      { label: 'Bank the coals (+50 gold)', outcome: { gold: 50 } },
    ],
  },
];

// Level-up boons offered mid-run (the incremental inside-a-run growth).
export const BOONS = [
  { id: 'hp', name: 'Tempered Frame', desc: '+12 max HP and heal 12', stat: { maxHp: 12 }, heal: 12 },
  { id: 'atk', name: 'Sharper Edge', desc: '+2 attack', stat: { atk: 2 } },
  { id: 'spd', name: 'Quickstep', desc: '+0.08 attack speed', stat: { atkSpeed: 0.08 } },
  { id: 'mana', name: 'Deep Lungs', desc: '+2 mana regen', stat: { manaRegen: 2 } },
  { id: 'armor', name: 'Slag Hide', desc: '+1 armor', stat: { armor: 1 } },
  { id: 'heal', name: 'Emberbroth', desc: 'Heal 40% of max HP', healPct: 0.4 },
  { id: 'crit', name: 'Find the Gap', desc: '+5% crit chance', stat: { crit: 0.05 } },
  { id: 'ls', name: 'Bloodthirst', desc: '+4% lifesteal', stat: { lifesteal: 0.04 } },
];

// Meta progression — the Forge. Costs are in embers.
export const FORGE = [
  { id: 'heart_coal', name: 'Heart of Coal', desc: '+8 max HP per level', max: 10, base: 15, growth: 1.55, stat: { maxHp: 8 } },
  { id: 'bellows_up', name: 'Bellows', desc: '+1 attack per level', max: 10, base: 20, growth: 1.55, stat: { atk: 1 } },
  { id: 'quickstep_meta', name: 'Quickstep Drills', desc: '+0.04 attack speed per level', max: 6, base: 40, growth: 1.6, stat: { atkSpeed: 0.04 } },
  { id: 'slag_hide', name: 'Slag Hide', desc: '+1 armor per level', max: 5, base: 30, growth: 1.6, stat: { armor: 1 } },
  { id: 'deep_lungs', name: 'Deep Lungs', desc: '+1.5 mana regen per level', max: 8, base: 25, growth: 1.55, stat: { manaRegen: 1.5 } },
  { id: 'purse', name: 'Kindling Purse', desc: '+20 starting gold per level', max: 5, base: 20, growth: 1.5, gold: 20 },
  { id: 'lucky', name: 'Lucky Charm', desc: '+5 luck per level (shops, spoils)', max: 4, base: 35, growth: 1.6, stat: { luck: 5 } },
  { id: 'forge_heart', name: 'Forge Heart', desc: '+0.02 embers/sec idle income per level', max: 10, base: 50, growth: 1.6, idle: 0.02 },
  { id: 'pouch', name: 'Field Pouch', desc: '+1 starting potion per level', max: 2, base: 60, growth: 2.0, potion: 1 },
  { id: 'ember_jar', name: 'Ember Jar', desc: '+10% embers from runs per level', max: 5, base: 40, growth: 1.7, emberBonus: 0.1 },
];

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Win your first fight', reward: 5, check: (m) => (m.stats.kills || 0) >= 1 },
  { id: 'act1', name: 'Stair Climber', desc: 'Defeat The Cinder Warden', reward: 20, check: (m) => (m.stats.bossKills || 0) >= 1 },
  { id: 'act2', name: 'Forgebreaker', desc: 'Defeat The Hollow Smith', reward: 40, check: (m) => (m.stats.actsCleared || 0) >= 2 },
  { id: 'act3', name: 'Silencer', desc: 'Defeat The Pale Choir', reward: 80, check: (m) => (m.stats.actsCleared || 0) >= 3 },
  { id: 'deep', name: 'Past the Pale', desc: 'Reach floor 30', reward: 60, check: (m) => (m.stats.bestFloor || 0) >= 30 },
  { id: 'rich', name: 'Cinder Baron', desc: 'Hold 500 embers at once', reward: 30, check: (m) => (m.embers || 0) >= 500 },
  { id: 'collector', name: 'Hoarder', desc: 'Carry 5 relics in one run', reward: 25, check: (m, r) => (r.relics || 0) >= 5 },
  { id: 'reforge', name: 'Reforged', desc: 'Reforge for the first time', reward: 30, check: (m) => (m.cinders || 0) >= 1 },
  { id: 'all_classes', name: 'Three Paths', desc: 'Unlock every class', reward: 50, check: (m) => Object.keys(m.unlocked).length >= 3 },
  { id: 'endless', name: 'Loopwalker', desc: 'Clear 5 acts in one run', reward: 70, check: (m, r) => (r.actsCleared || 0) >= 5 },
];

export const xpForLevel = (level) => 30 + level * 28;

export function abilityPoolFor(cls, rarity) {
  return Object.entries(ABILITIES).filter(([id, a]) =>
    (a.cls === cls || a.cls === null) && (!rarity || a.rarity === rarity));
}
