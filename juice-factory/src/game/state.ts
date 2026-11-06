// The saved game state, and loading older save formats.

export type Counts = Record<string, number>;

export interface State {
  juice: number;
  money: number;
  totalJuice: number;
  totalSold: number;
  totalEarned: number;
  /** Juice squeezed by hand. */
  hand: number;
  clicks: number;
  /** Cups sold by hand. */
  sells: number;
  /** Golden mangoes caught. */
  golden: number;
  /** Machines owned, by id. */
  owned: Counts;
  /** Shops owned, by id. */
  shops: Counts;
  /** One-off upgrades bought, by id. */
  upg: Record<string, number>;
  /** Level per levelled upgrade, by id. */
  lv: Counts;
  started: number;
  last: number;
}

/** Timed bonuses from golden mangoes, as epoch ms they run until. Not saved. */
export interface Boosts {
  /** Mango Frenzy: machines ×7. */
  frenzyUntil: number;
  /** Pulp Rush: squeezes ×77. */
  rushUntil: number;
  /** Rush Hour: prices ×3. */
  hourUntil: number;
}

export interface Game {
  s: State;
  boosts: Boosts;
}

export function fresh(now = Date.now()): State {
  return {
    juice: 0, money: 0, totalJuice: 0, totalSold: 0, totalEarned: 0, hand: 0, clicks: 0, sells: 0, golden: 0,
    owned: {}, shops: {}, upg: {}, lv: {}, started: now, last: now,
  };
}

export const noBoosts = (): Boosts => ({ frenzyUntil: 0, rushUntil: 0, hourUntil: 0 });

/** Fills in any fields missing from a saved state (from an older version, or a hand-edited save). */
export function normalize(d: Partial<State> | null | undefined): State {
  return {
    ...fresh(),
    ...d,
    owned: { ...d?.owned },
    shops: { ...d?.shops },
    upg: { ...d?.upg },
    lv: { ...d?.lv },
  };
}

/** Shape of a v1 save, from before shops existed. */
export interface StateV1 {
  juice?: number;
  total?: number;
  hand?: number;
  clicks?: number;
  golden?: number;
  started?: number;
  owned?: Counts;
  lv?: Counts;
}

/** Converts a v1 save. Its money-free machines map onto today's machines and shops. */
export function migrate(old: StateV1): State {
  const n = fresh();
  const o = old.owned || {};
  n.juice = old.juice || 0;
  n.totalJuice = old.total || 0;
  n.hand = old.hand || 0;
  n.clicks = old.clicks || 0;
  n.golden = old.golden || 0;
  n.started = old.started || Date.now();
  n.lv.hands = old.lv?.hands || 0;
  n.lv.wrists = old.lv?.wrists || 0;
  n.lv.instinct = old.lv?.instinct || 0;
  for (const k of ['squeezer', 'press', 'orchard', 'plant', 'refinery', 'orbital', 'singular']) if (o[k]) n.owned[k] = o[k];
  if (o.bottling) n.owned.mill = o.bottling;
  if (o.stand) n.shops.stand = o.stand;
  if (o.tanker) n.shops.vans = o.tanker;
  return n;
}
