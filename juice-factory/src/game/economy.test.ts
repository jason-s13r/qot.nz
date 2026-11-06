import { describe, expect, it } from 'vitest';
import { LV, MACH, SHOPS, U } from './content';
import {
  buyBuilding, buyLevel, buyUpgrade, bulkCost, catchGolden, catchUp, cupSize, jps, perClick, price, savingFor,
  sellCup, sellingRate, shopRate, squeeze, step,
} from './economy';
import { cash, vol } from './format';
import { fresh, migrate, noBoosts, normalize, type Game } from './state';

const newGame = (): Game => ({ s: fresh(0), boosts: noBoosts() });
const T = 1_000_000; // a fixed "now"

describe('format', () => {
  it('scales volumes and money', () => {
    expect(vol(0)).toBe('0 mL');
    expect(vol(1.5)).toBe('1.5 mL');
    expect(vol(20)).toBe('20 mL');
    expect(vol(1500)).toBe('1.50 L');
    expect(vol(2.5e6)).toBe('2.50 kL');
    expect(cash(2)).toBe('$2.00');
    expect(cash(150)).toBe('$150');
    expect(cash(12_345)).toBe('$12.3K');
    expect(cash(Infinity)).toBe('$∞');
  });
});

describe('content', () => {
  it('has unique ids and sorted upgrades', () => {
    const ids = [...MACH, ...SHOPS].map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(U.map((u) => u.id)).size).toBe(U.length);
    expect(U.length).toBe(10 + (MACH.length + SHOPS.length) * 5);
    expect(U.map((u) => u.cost)).toEqual([...U.map((u) => u.cost)].sort((a, b) => a - b));
  });
});

describe('squeezing and selling', () => {
  it('starts at 1 mL a squeeze and a 20 mL cup worth $2', () => {
    const g = newGame();
    expect(squeeze(g, T)).toBe(1);
    expect(g.s.clicks).toBe(1);
    g.s.juice = 30;
    expect(cupSize(g.s)).toBe(20);
    expect(sellCup(g, T)).toBeCloseTo(2);
    expect(g.s.juice).toBe(10);
    expect(g.s.sells).toBe(1);
  });

  it('sells nothing from an empty tank', () => {
    const g = newGame();
    expect(sellCup(g, T)).toBe(0);
    expect(g.s.sells).toBe(0);
  });

  it('applies levels and boosts to a squeeze', () => {
    const g = newGame();
    g.s.lv = { hands: 2, wrists: 1 };
    expect(perClick(g, T)).toBe(6);
    g.boosts.rushUntil = T + 1;
    expect(perClick(g, T)).toBe(6 * 77);
  });
});

describe('buying', () => {
  it('prices buildings 15% up each, with bulk discounts', () => {
    const stand = SHOPS[0];
    expect(bulkCost(stand, 0, 1)).toBeCloseTo(2);
    expect(bulkCost(stand, 1, 1)).toBeCloseTo(2.3);
    const ten = (stand.base * (Math.pow(1.15, 10) - 1)) / 0.15;
    expect(bulkCost(stand, 0, 10)).toBeCloseTo(ten * 0.9);
  });

  it('only buys what you can afford', () => {
    const g = newGame();
    expect(buyBuilding(g.s, 'sell', SHOPS[0], 1)).toBe(false);
    g.s.money = 5;
    expect(buyBuilding(g.s, 'sell', SHOPS[0], 1)).toBe(true);
    expect(g.s.shops.stand).toBe(1);
    expect(g.s.money).toBeCloseTo(3);
    expect(buyLevel(g.s, LV[0])).toBe(true);
    expect(g.s.lv.hands).toBe(1);
    const labels = U.find((u) => u.id === 'p1')!;
    g.s.money = 100;
    expect(buyUpgrade(g.s, labels)).toBe(true);
    expect(buyUpgrade(g.s, labels)).toBe(false);
    expect(price(g, T)).toBeCloseTo(0.15);
  });
});

describe('the loop', () => {
  it('machines make juice and shops sell it', () => {
    const g = newGame();
    g.s.owned.press = 2; // 2 mL/s
    g.s.shops.stand = 5; // 1 mL/s
    expect(jps(g, T)).toBe(2);
    expect(shopRate(g.s)).toBe(1);
    step(g, 1, T);
    expect(g.s.juice).toBeCloseTo(1);
    expect(g.s.totalSold).toBeCloseTo(1);
    expect(g.s.money).toBeCloseTo(0.1);
  });

  it('shops only sell as fast as machines once stock runs low', () => {
    const g = newGame();
    g.s.owned.squeezer = 1; // 0.1 mL/s
    g.s.shops.cart = 1; // 1.2 mL/s
    expect(sellingRate(g, T)).toBeCloseTo(0.1);
  });

  it('catches up at half speed for at most 30 minutes', () => {
    const g = newGame();
    g.s.owned.press = 1;
    g.s.last = 0;
    const away = catchUp(g, 60 * 60 * 1000)!;
    expect(away.made).toBeCloseTo(30 * 60 * 0.5);
    expect(catchUp({ s: { ...g.s, last: T }, boosts: noBoosts() }, T + 30_000)).toBeNull();
  });
});

describe('golden mangoes', () => {
  it('gives a frenzy when machines are running', () => {
    const g = newGame();
    g.s.owned.press = 1;
    expect(catchGolden(g, 0.1, T).kind).toBe('frenzy');
    expect(jps(g, T)).toBe(7);
    expect(g.s.golden).toBe(1);
  });

  it('falls through to a pulp rush with no machines or shops', () => {
    expect(catchGolden(newGame(), 0.1, T).kind).toBe('pulpRush');
  });

  it('pays out a windfall', () => {
    const g = newGame();
    const bonus = catchGolden(g, 0.9, T);
    expect(bonus).toEqual({ kind: 'windfall', amount: 1 });
    expect(g.s.money).toBe(1);
  });
});

describe('saving for', () => {
  it('targets the cheapest thing not yet affordable', () => {
    const g = newGame();
    expect(savingFor(g.s).name).toBe('Hand Squeezer');
    g.s.money = 1.6;
    expect(savingFor(g.s).name).toBe('Lemonade Stand');
  });
});

describe('saves', () => {
  it('fills in missing fields', () => {
    const s = normalize({ juice: 5, owned: { press: 1 } });
    expect(s.juice).toBe(5);
    expect(s.owned).toEqual({ press: 1 });
    expect(s.shops).toEqual({});
    expect(s.lv).toEqual({});
  });

  it('migrates v1 saves', () => {
    const s = migrate({ juice: 10, total: 100, clicks: 4, owned: { press: 3, bottling: 2, stand: 1, tanker: 5 }, lv: { hands: 2 } });
    expect(s.totalJuice).toBe(100);
    expect(s.owned).toEqual({ press: 3, mill: 2 });
    expect(s.shops).toEqual({ stand: 1, vans: 5 });
    expect(s.lv.hands).toBe(2);
  });
});
