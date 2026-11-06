// Everything you can buy in Juice Factory, plus the news ticker.
// Ids are stored in saves: add new entries rather than renaming existing ones.

import { count, fmtMult, vol } from './format';
import type { State } from './state';

export type Side = 'juice' | 'sell';

export interface Building {
  id: string;
  ico: string;
  name: string;
  desc: string;
  /** Price of the first one; each further one costs 15% more. */
  base: number;
  /** mL per second each one makes (machines) or sells (shops). */
  rate: number;
}

export interface Level {
  id: string;
  side: Side;
  name: string;
  base: number;
  /** Each level costs this many times the last. */
  grow: number;
  need: (s: State) => boolean;
  /** What the current level does, shown as "Now: …". */
  eff: (level: number) => string;
  next: string;
}

export type UpgradeKind = 'mglob' | 'sglob' | 'price' | 'tier' | 'luck';

export interface Upgrade {
  id: string;
  side: Side;
  name: string;
  desc: string;
  cost: number;
  need: (s: State) => boolean;
  /** mglob/sglob: all machines/shops, price: sell price, tier: one building ×2, luck: golden mango rate. */
  kind: UpgradeKind;
  mult?: number;
}

/** Machines make juice. */
export const MACH: Building[] = [
  { id: 'squeezer', ico: '🍋', name: 'Hand Squeezer', desc: 'A tired intern with a lemon.', base: 1.5, rate: 0.1 },
  { id: 'press', ico: '🍊', name: 'Citrus Press', desc: 'Cast iron. Leaks a little.', base: 10, rate: 1 },
  { id: 'orchard', ico: '🌳', name: 'Backyard Orchard', desc: 'Fruit falls straight into the jug.', base: 110, rate: 8 },
  { id: 'mill', ico: '⚙️', name: 'Pressing Mill', desc: 'Big wheels, big squish.', base: 1200, rate: 47 },
  { id: 'plant', ico: '🥭', name: 'Tropical Plantation', desc: 'Mangoes as far as you can see.', base: 13000, rate: 260 },
  { id: 'refinery', ico: '🏭', name: 'Juice Refinery', desc: 'Pulp goes in, purity comes out.', base: 140000, rate: 1400 },
  { id: 'orbital', ico: '🛰️', name: 'Orbital Orchard', desc: 'Zero-gravity grapefruit.', base: 2e6, rate: 7800 },
  { id: 'singular', ico: '🌀', name: 'Citrus Singularity', desc: 'All fruit, everywhere, at once.', base: 3.3e7, rate: 44000 },
];

/** Shops sell juice. */
export const SHOPS: Building[] = [
  { id: 'stand', ico: '🥤', name: 'Lemonade Stand', desc: 'Run by a very serious eight-year-old.', base: 2, rate: 0.2 },
  { id: 'cart', ico: '🛒', name: 'Juice Cart', desc: 'Rings a little bell.', base: 12, rate: 1.2 },
  { id: 'dairy', ico: '🏪', name: 'Corner Dairy', desc: 'Next to the pies and the ice blocks.', base: 130, rate: 10 },
  { id: 'bar', ico: '🍹', name: 'Juice Bar', desc: 'Smoothies with extra vibes.', base: 1400, rate: 55 },
  { id: 'super', ico: '🏬', name: 'Supermarket Shelf', desc: 'Eye level, next to the milk.', base: 15000, rate: 300 },
  { id: 'vans', ico: '🚚', name: 'Delivery Vans', desc: 'Juice at your door by lunchtime.', base: 160000, rate: 1600 },
  { id: 'airport', ico: '✈️', name: 'Airport Kiosks', desc: '$12 a bottle. People still buy it.', base: 2.2e6, rate: 9000 },
  { id: 'export', ico: '🚀', name: 'Interplanetary Export', desc: 'Mars is very thirsty.', base: 3.6e7, rate: 50000 },
];

/** Per-building tier upgrades: [number owned to unlock, cost as a multiple of base price, name suffix]. */
type Tier = [own: number, costMult: number, label: string];
export const M_TIERS: Tier[] = [[1, 10, 'Mk II'], [5, 50, 'Turbo'], [25, 500, 'Deluxe'], [50, 5000, 'Industrial'], [100, 50000, 'Quantum']];
export const S_TIERS: Tier[] = [[1, 10, 'Makeover'], [5, 50, 'Longer Hours'], [25, 500, 'Express Lane'], [50, 5000, 'Superstore'], [100, 50000, 'Galactic']];

/** Levels can be bought over and over. */
export const LV: Level[] = [
  { id: 'hands', side: 'juice', name: 'Extra Hands', base: 2.5, grow: 1.6, need: () => true,
    eff: (l) => `+${l} mL base squeeze`, next: '+1 mL base squeeze' },
  { id: 'wrists', side: 'juice', name: 'Strong Wrists', base: 10, grow: 4, need: (s) => s.clicks >= 10,
    eff: (l) => `squeeze ×${fmtMult(Math.pow(2, l))}`, next: 'doubles your squeeze' },
  { id: 'instinct', side: 'juice', name: 'Juicer’s Instinct', base: 10000, grow: 8, need: (s) => s.totalJuice >= 5e4,
    eff: (l) => `+${l}% of machine mL/s per squeeze`, next: '+1% of machine mL/s per squeeze' },
  { id: 'cups', side: 'sell', name: 'Bigger Cups', base: 3, grow: 3, need: (s) => s.sells >= 1,
    eff: (l) => `cups hold ${vol(20 * Math.pow(2, l))}`, next: 'doubles the cup size' },
  { id: 'prices', side: 'sell', name: 'Better Prices', base: 25, grow: 6, need: (s) => s.totalSold >= 50,
    eff: (l) => `prices ×${Math.pow(1.25, l).toFixed(2)}`, next: 'juice sells for 25% more' },
  { id: 'pitch', side: 'sell', name: 'Sales Pitch', base: 1000, grow: 8, need: (s) => s.totalEarned >= 500,
    eff: (l) => `+${l}% of shop $/s per sale`, next: '+1% of shop $/s per sale' },
];

function tierUpgrades(buildings: Building[], tiers: Tier[], side: Side, store: 'owned' | 'shops', verb: string): Upgrade[] {
  return buildings.flatMap((b) => tiers.map(([own, mul, label], t): Upgrade => ({
    id: `${b.id}-${t}`, side, name: `${b.name} ${label}`, desc: `${b.name}s ${verb}.`,
    cost: b.base * mul, need: (s) => (s[store][b.id] || 0) >= own, kind: 'tier',
  })));
}

const FACTORY_UPGRADES: Upgrade[] = [
  { id: 'mg1', side: 'juice', name: 'Cold Press Tech', desc: 'All machines +50%.', cost: 150, need: (s) => count(s.owned) >= 5, kind: 'mglob', mult: 1.5 },
  { id: 'mg2', side: 'juice', name: 'Night Shift', desc: 'All machines make twice as much.', cost: 1.5e5, need: (s) => count(s.owned) >= 50, kind: 'mglob', mult: 2 },
  { id: 'mg3', side: 'juice', name: 'Robot Pickers', desc: 'All machines make twice as much.', cost: 1.5e8, need: (s) => count(s.owned) >= 150, kind: 'mglob', mult: 2 },
  { id: 'luck', side: 'juice', name: 'Mango Radar', desc: 'Golden mangoes appear more often.', cost: 7.7e4, need: (s) => s.golden >= 1, kind: 'luck' },
  { id: 'p1', side: 'sell', name: 'Fancy Labels', desc: 'Juice sells for 50% more.', cost: 50, need: (s) => s.totalSold >= 200, kind: 'price', mult: 1.5 },
  { id: 'p2', side: 'sell', name: 'Not From Concentrate', desc: 'Juice sells for twice as much.', cost: 5000, need: (s) => s.totalEarned >= 2000, kind: 'price', mult: 2 },
  { id: 'p3', side: 'sell', name: 'Organic Certification', desc: 'Juice sells for twice as much.', cost: 5e5, need: (s) => s.totalEarned >= 2e5, kind: 'price', mult: 2 },
  { id: 'sg1', side: 'sell', name: 'Loyalty Cards', desc: 'All shops sell 50% faster.', cost: 200, need: (s) => count(s.shops) >= 5, kind: 'sglob', mult: 1.5 },
  { id: 'sg2', side: 'sell', name: 'Online Ordering', desc: 'All shops sell twice as fast.', cost: 2e5, need: (s) => count(s.shops) >= 50, kind: 'sglob', mult: 2 },
  { id: 'sg3', side: 'sell', name: 'Drone Delivery', desc: 'All shops sell twice as fast.', cost: 2e8, need: (s) => count(s.shops) >= 150, kind: 'sglob', mult: 2 },
];

/** One-off upgrades, cheapest first. */
export const U: Upgrade[] = [
  ...FACTORY_UPGRADES,
  ...tierUpgrades(MACH, M_TIERS, 'juice', 'owned', 'make twice as much'),
  ...tierUpgrades(SHOPS, S_TIERS, 'sell', 'shops', 'sell twice as fast'),
].sort((a, b) => a.cost - b.cost);

/** News ticker lines: [total money earned to unlock, text]. */
export const NEWS: [number, string][] = [
  [0, 'You have a fruit and a dream.'],
  [0, 'Local orange describes being squeezed as “fine, honestly.”'],
  [5, 'First customer says the juice is “very orange.”'],
  [50, 'Neighbour asks why your kitchen smells like a citrus grove.'],
  [500, 'Sticky coins reported in your street.'],
  [5000, 'Lemons nationwide begin to worry.'],
  [5e4, 'Juice Factory juice voted “most juice” by people who drink juice.'],
  [5e5, 'Scientists confirm your juice is 100% wet.'],
  [5e6, 'Supermarkets run out of cups. Shoppers drink straight from the carton.'],
  [5e7, 'Economists propose the litre of OJ as a new world currency.'],
  [5e8, 'Weather forecast: light pulp, clearing by afternoon.'],
  [5e9, 'Astronauts spot a sticky orange patch from orbit.'],
  [5e10, 'Mars places its biggest order yet.'],
];
