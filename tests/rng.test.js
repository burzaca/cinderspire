import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashSeed, todaySeed } from '../src/rng.js';

test('same seed produces identical sequence', () => {
  const a = makeRng(1234), b = makeRng(1234);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notDeepEqual([...Array(10)].map(() => a.next()), [...Array(10)].map(() => b.next()));
});

test('int stays within inclusive bounds', () => {
  const r = makeRng(7);
  for (let i = 0; i < 200; i++) {
    const v = r.int(3, 9);
    assert.ok(v >= 3 && v <= 9 && Number.isInteger(v));
  }
});

test('getState/setState round-trips the stream', () => {
  const r = makeRng(99);
  for (let i = 0; i < 10; i++) r.next();
  const st = r.getState();
  const expected = [r.next(), r.next(), r.next()];
  r.setState(st);
  assert.deepEqual([r.next(), r.next(), r.next()], expected);
});

test('hashSeed is stable across calls', () => {
  assert.equal(hashSeed('cinderspire-2026-10-24'), hashSeed('cinderspire-2026-10-24'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('todaySeed is stable within a local calendar day and flips at midnight', () => {
  const noon = new Date(2026, 9, 24, 12, 0, 0);
  const lateNight = new Date(2026, 9, 24, 23, 59, 59);
  const nextDay = new Date(2026, 9, 25, 0, 1, 0);
  assert.equal(todaySeed(noon), todaySeed(lateNight));
  assert.notEqual(todaySeed(noon), todaySeed(nextDay));
});

test('weighted respects zero weights', () => {
  const r = makeRng(5);
  for (let i = 0; i < 100; i++) {
    assert.equal(r.weighted([['a', 0], ['b', 1]]), 'b');
  }
});

test('shuffle is a permutation and deterministic per seed', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = makeRng(42).shuffle(arr);
  const b = makeRng(42).shuffle(arr);
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort((x, y) => x - y), arr);
});
