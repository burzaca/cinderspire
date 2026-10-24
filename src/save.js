// Persistence wrapper. Browser: localStorage. Node (tests/sim): in-memory.
const KEY = 'cinder…e-v1';
const memory = {};

function backend() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (_) { /* private mode etc. */ }
  return {
    getItem: (k) => (k in memory ? memory[k] : null),
    setItem: (k, v) => { memory[k] = String(v); },
    removeItem: (k) => { delete memory[k]; },
  };
}

export function loadJSON(key) {
  try {
    const raw = backend().getItem(KEY + ':' + key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveJSON(key, value) {
  try {
    backend().setItem(KEY + ':' + key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearAll() {
  try {
    backend().removeItem(KEY + ':meta');
    backend().removeItem(KEY + ':run');
  } catch (_) {}
}
