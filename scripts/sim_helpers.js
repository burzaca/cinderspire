import { computeStats } from '../src/run.js';

// Door policy shared by the simulator and debug tools: a "decent player" proxy.
export function pickDoor(run, bonuses) {
  const stats = computeStats(run, bonuses);
  const hp = run.hpCurrent == null ? stats.maxHp : run.hpCurrent;
  const doors = run.doorOptions;
  if (hp < stats.maxHp * 0.65) {
    const rest = doors.find((d) => d.type === 'rest');
    if (rest) return rest;
  }
  const shop = doors.find((d) => d.type === 'shop');
  if (shop && run.gold > 150) return shop;
  const fight = doors.find((d) => d.type === 'combat') || doors.find((d) => d.type === 'elite') || doors[0];
  return fight;
}
