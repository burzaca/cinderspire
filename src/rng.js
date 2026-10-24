// Deterministic seeded RNG (mulberry32) + helpers. Every run, map and battle
// derives from one seed, so runs are reproducible and daily seeds are fair.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),          // inclusive
    range: (lo, hi) => lo + next() * (hi - lo),                        // float
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
    weighted: (entries) => { // [[value, weight], ...]
      const total = entries.reduce((s, e) => s + e[1], 0);
      let r = next() * total;
      for (const [v, w] of entries) { r -= w; if (r < 0) return v; }
      return entries[entries.length - 1][0];
    },
    getState: () => a >>> 0,
    setState: (v) => { a = v >>> 0; },
  };
}

// String -> stable 32-bit seed (for daily seeds / share codes).
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function todaySeed(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return hashSeed(`cinderspire-${y}-${m}-${d}`);
}
