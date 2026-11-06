// The game's rules: rates, prices, costs, and the actions that change state. No DOM.

import { LV, MACH, SHOPS, U, type Building, type Level, type Side, type Upgrade, type UpgradeKind } from './content';
import type { Game, State } from './state';

export const STORE: Record<Side, 'owned' | 'shops'> = { juice: 'owned', sell: 'shops' };

export const lv = (s: State, id: string) => s.lv[id] || 0;
export const lvCost = (s: State, q: Level) => q.base * Math.pow(q.grow, lv(s, q.id));

/** ×2 for each tier upgrade bought for this building. */
function tierMult(s: State, id: string): number {
  let m = 1;
  for (let t = 0; t < 5; t++) if (s.upg[`${id}-${t}`]) m *= 2;
  return m;
}
function kindMult(s: State, kind: UpgradeKind): number {
  let m = 1;
  for (const u of U) if (u.kind === kind && s.upg[u.id]) m *= u.mult ?? 1;
  return m;
}

export const machEach = (s: State, b: Building) => b.rate * tierMult(s, b.id) * kindMult(s, 'mglob');
export const shopEach = (s: State, b: Building) => b.rate * tierMult(s, b.id) * kindMult(s, 'sglob');

/** Machine output in mL/s, without Mango Frenzy. */
export const baseJps = (s: State) => MACH.reduce((r, b) => r + (s.owned[b.id] || 0) * machEach(s, b), 0);
export const jps = (g: Game, now = Date.now()) => baseJps(g.s) * (now < g.boosts.frenzyUntil ? 7 : 1);
/** How much the shops could sell, in mL/s. */
export const shopRate = (s: State) => SHOPS.reduce((r, b) => r + (s.shops[b.id] || 0) * shopEach(s, b), 0);
/** Dollars per mL. */
export const price = (g: Game, now = Date.now()) =>
  0.1 * Math.pow(1.25, lv(g.s, 'prices')) * kindMult(g.s, 'price') * (now < g.boosts.hourUntil ? 3 : 1);
export const cupSize = (s: State) => 20 * Math.pow(2, lv(s, 'cups'));

/** mL/s the shops actually sell: limited by machine output once the stock runs low. */
export function sellingRate(g: Game, now = Date.now()): number {
  const r = shopRate(g.s);
  return g.s.juice > r * 0.5 ? r : Math.min(r, jps(g, now));
}
export const moneyRate = (g: Game, now = Date.now()) => sellingRate(g, now) * price(g, now);

export function perClick(g: Game, now = Date.now()): number {
  const c = (1 + lv(g.s, 'hands')) * Math.pow(2, lv(g.s, 'wrists')) + jps(g, now) * 0.01 * lv(g.s, 'instinct');
  return now < g.boosts.rushUntil ? c * 77 : c;
}

/** Bulk discount: a flat cut on the whole batch (×10 = 10% off, ×100 = 20% off). */
export const bulkDisc = (n: number) => (n >= 100 ? 0.8 : n >= 10 ? 0.9 : 1);
/** Cost of `n` more of a building when you already have `have`; each one costs 15% more than the last. */
export const bulkCost = (b: Building, have: number, n: number) =>
  ((b.base * Math.pow(1.15, have) * (Math.pow(1.15, n) - 1)) / 0.15) * bulkDisc(n);

function addJuice(s: State, v: number) {
  s.juice += v;
  s.totalJuice += v;
}
function addMoney(s: State, v: number) {
  s.money += v;
  s.totalEarned += v;
}
function sell(s: State, amount: number, value: number) {
  s.juice -= amount;
  s.totalSold += amount;
  addMoney(s, value);
}

/* ---------- actions ---------- */

/** One tap of the fruit. Returns the mL squeezed. */
export function squeeze(g: Game, now = Date.now()): number {
  const v = perClick(g, now);
  addJuice(g.s, v);
  g.s.hand += v;
  g.s.clicks++;
  return v;
}

/** One tap of "Sell a cup". Returns the money made, or 0 if there was no juice. */
export function sellCup(g: Game, now = Date.now()): number {
  const amt = Math.min(g.s.juice, cupSize(g.s));
  if (amt <= 0) return 0;
  const v = amt * price(g, now) + shopRate(g.s) * price(g, now) * 0.01 * lv(g.s, 'pitch');
  sell(g.s, amt, v);
  g.s.sells++;
  return v;
}

export function buyBuilding(s: State, side: Side, b: Building, qty: number): boolean {
  const st = s[STORE[side]];
  const c = bulkCost(b, st[b.id] || 0, qty);
  if (s.money < c) return false;
  s.money -= c;
  st[b.id] = (st[b.id] || 0) + qty;
  return true;
}

export function buyLevel(s: State, q: Level): boolean {
  const c = lvCost(s, q);
  if (s.money < c) return false;
  s.money -= c;
  s.lv[q.id] = lv(s, q.id) + 1;
  return true;
}

export function buyUpgrade(s: State, u: Upgrade): boolean {
  if (s.upg[u.id] || s.money < u.cost) return false;
  s.money -= u.cost;
  s.upg[u.id] = 1;
  return true;
}

/** Advances machines and shops by `dt` seconds. */
export function step(g: Game, dt: number, now = Date.now()) {
  addJuice(g.s, jps(g, now) * dt);
  const sold = Math.min(g.s.juice, shopRate(g.s) * dt);
  if (sold > 0) sell(g.s, sold, sold * price(g, now));
}

/** Catches up on time away: half speed, capped at 30 minutes. Returns what happened, for the welcome-back toast. */
export function catchUp(g: Game, now = Date.now()): { made: number; earned: number } | null {
  const away = Math.min((now - g.s.last) / 1000, 30 * 60);
  if (away <= 60) return null;
  const made = baseJps(g.s) * away * 0.5;
  const sold = Math.min(g.s.juice + made, shopRate(g.s) * away * 0.5);
  addJuice(g.s, made);
  const earned = sold * price(g, now);
  sell(g.s, sold, earned);
  return { made, earned };
}

/* ---------- golden mango ---------- */

/** Seconds until the next golden mango. */
export const goldenDelay = (s: State, r = Math.random()) => (50 + r * 100) * (s.upg.luck ? 0.6 : 1);

export type GoldenBonus =
  | { kind: 'frenzy' }
  | { kind: 'rushHour' }
  | { kind: 'pulpRush' }
  | { kind: 'windfall'; amount: number };

/** Applies a caught golden mango's bonus. */
export function catchGolden(g: Game, roll = Math.random(), now = Date.now()): GoldenBonus {
  g.s.golden++;
  if (roll < 0.3 && baseJps(g.s) > 0) {
    g.boosts.frenzyUntil = now + 60_000;
    return { kind: 'frenzy' };
  }
  if (roll < 0.55 && shopRate(g.s) > 0) {
    g.boosts.hourUntil = now + 60_000;
    return { kind: 'rushHour' };
  }
  if (roll < 0.8) {
    g.boosts.rushUntil = now + 13_000;
    return { kind: 'pulpRush' };
  }
  const amount = Math.max(1, Math.min(g.s.money * 0.15, moneyRate(g, now) * 900) + 1);
  addMoney(g.s, amount);
  return { kind: 'windfall', amount };
}

/* ---------- what to save for ---------- */

/** The cheapest thing you can't afford yet (or the cheapest thing, if you can afford everything). */
export function savingFor(s: State): { cost: number; name: string } {
  let target: { cost: number; name: string } | null = null;
  let cheapest: { cost: number; name: string } | null = null;
  const consider = (cost: number, name: string) => {
    if (!cheapest || cost < cheapest.cost) cheapest = { cost, name };
    if (cost > s.money && (!target || cost < target.cost)) target = { cost, name };
  };
  for (const b of MACH) consider(bulkCost(b, s.owned[b.id] || 0, 1), b.name);
  for (const b of SHOPS) consider(bulkCost(b, s.shops[b.id] || 0, 1), b.name);
  for (const u of U) if (!s.upg[u.id] && u.need(s)) consider(u.cost, u.name);
  for (const q of LV) if (lv(s, q.id) > 0 || q.need(s)) consider(lvCost(s, q), `${q.name} Lv ${lv(s, q.id) + 1}`);
  return (target ?? cheapest)!;
}
