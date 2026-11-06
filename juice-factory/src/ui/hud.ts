// The header counters, the news ticker, and the stats in the footer.

import { NEWS } from '../game/content';
import { jps, price, sellingRate } from '../game/economy';
import { cash, count, dur, vol } from '../game/format';
import type { Game } from '../game/state';
import { byId, setText } from './dom';

export function mountHud(game: Game) {
  const els = {
    juice: byId('amtJuice'),
    money: byId('amtMoney'),
    rateJuice: byId('rateJuice'),
    rateMoney: byId('rateMoney'),
    news: byId('news'),
    stats: byId('stats'),
  };

  // Keep the sticky press below the sticky header, whatever height the header wraps to.
  const header = document.querySelector<HTMLElement>('header.top')!;
  const setHeaderHeight = () => document.documentElement.style.setProperty('--hh', `${header.offsetHeight}px`);
  setHeaderHeight();
  new ResizeObserver(setHeaderHeight).observe(header);

  let statCells: HTMLElement[] = [];
  let newsIdx = 0;

  return {
    render(now: number) {
      const s = game.s;
      const frenzy = now < game.boosts.frenzyUntil;
      const rushHour = now < game.boosts.hourUntil;
      setText(els.juice, vol(s.juice));
      setText(els.money, cash(s.money));
      setText(els.rateJuice, vol(jps(game, now)) + ' per second' + (frenzy ? ' · Frenzy ×7' : ''));
      els.rateJuice.classList.toggle('hot', frenzy);
      setText(els.rateMoney, cash(sellingRate(game, now) * price(game, now)) + ' per second' + (rushHour ? ' · Rush Hour ×3' : ''));
      els.rateMoney.classList.toggle('hot', rushHour);
    },

    /** The footer stats; these change slowly, so they're drawn every few seconds. */
    renderStats(now: number) {
      const s = game.s;
      const rows: [string, string][] = [
        ['Juice squeezed', vol(s.totalJuice)],
        ['By hand', vol(s.hand)],
        ['Juice sold', vol(s.totalSold)],
        ['Money earned', cash(s.totalEarned)],
        ['Squeezes', s.clicks.toLocaleString()],
        ['Cups sold by hand', s.sells.toLocaleString()],
        ['Machines', count(s.owned).toLocaleString()],
        ['Shops', count(s.shops).toLocaleString()],
        ['Golden mangoes', String(s.golden)],
        ['Running for', dur((now - s.started) / 1000)],
      ];
      if (!statCells.length) {
        els.stats.innerHTML = rows.map(([k]) => `<div><dt>${k}</dt><dd></dd></div>`).join('');
        statCells = [...els.stats.querySelectorAll('dd')];
      }
      rows.forEach(([, v], i) => setText(statCells[i], v));
    },

    /** Shows the next headline from those unlocked so far, newest first. */
    rotateNews() {
      const pool = NEWS.filter(([t]) => game.s.totalEarned >= t);
      newsIdx = (newsIdx + 1) % pool.length;
      els.news.textContent = pool[pool.length - 1 - newsIdx][1];
    },
  };
}
