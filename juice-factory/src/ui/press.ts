// The juice press: the fruit, the Sell button, the tank, and golden mangoes.

import { catchGolden, cupSize, goldenDelay, jps, perClick, price, savingFor, sellCup, shopRate, squeeze } from '../game/economy';
import { cash, vol } from '../game/format';
import type { Game } from '../game/state';
import { byId, fromHTML, setDisabled, setText } from './dom';
import { toast } from './toast';

const GOLDEN_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><path style="fill:var(--gold);stroke:var(--ink)" d="M50 14 C 80 14, 92 44, 84 66 C 76 88, 40 94, 22 78 C 6 62, 14 30, 30 20 C 37 16, 44 14, 50 14 Z" stroke-width="4"/><path style="fill:var(--leaf);stroke:var(--ink)" d="M50 14 C 56 4, 70 2, 78 6 C 70 14, 60 16, 50 14 Z" stroke-width="3"/><ellipse cx="36" cy="38" rx="8" ry="4" fill="#fff" opacity=".6" transform="rotate(-40 36 38)"/></svg>`;
const GOLDEN_LIFETIME_MS = 13_000;

export function mountPress(game: Game, changed: (full?: boolean) => void) {
  const press = byId('press');
  const fruit = byId<HTMLButtonElement>('fruit');
  const sellBtn = byId<HTMLButtonElement>('sellBtn');
  const els = {
    perClick: byId('perclick'),
    sellVal: byId('sellVal'),
    shopStatus: byId('shopStatus'),
    liquid: byId('liquid'),
    tankName: byId('tankName'),
    tankPct: byId('tankPct'),
  };

  // The press clips its overflow; stop focus or keyboard scrolling from shifting its contents.
  press.addEventListener('scroll', () => {
    press.scrollTop = 0;
    press.scrollLeft = 0;
  });

  /** Where on the press an event happened, or the centre of `el` for keyboard presses. */
  function pointIn(e: MouseEvent, el: HTMLElement): [number, number] {
    const r = press.getBoundingClientRect();
    if (e.clientX || e.clientY) return [e.clientX - r.left, e.clientY - r.top];
    const f = el.getBoundingClientRect();
    return [f.left - r.left + f.width / 2, f.top - r.top + f.height / 2];
  }

  function removeWhenDone(el: HTMLElement) {
    el.addEventListener('animationend', () => el.remove());
    press.appendChild(el);
  }

  function floatText(x: number, y: number, text: string, cls = '') {
    const fl = document.createElement('span');
    fl.className = 'float' + (cls ? ' ' + cls : '');
    fl.textContent = text;
    fl.style.left = `${x - 20}px`;
    fl.style.top = `${y - 30}px`;
    removeWhenDone(fl);
  }

  function splash(x: number, y: number) {
    if (press.querySelectorAll('.drop').length >= 40) return;
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('span');
      d.className = 'drop';
      const a = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      d.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
      d.style.setProperty('--dy', `${Math.sin(a) * dist + 40}px`);
      removeWhenDone(d);
    }
  }

  fruit.addEventListener('click', (e) => {
    const v = squeeze(game);
    fruit.classList.remove('squish');
    void fruit.offsetWidth; // restart the animation
    fruit.classList.add('squish');
    const [x, y] = pointIn(e, fruit);
    floatText(x, y, '+' + vol(v));
    splash(x, y);
    changed();
  });

  sellBtn.addEventListener('click', (e) => {
    const v = sellCup(game);
    if (!v) return;
    const [x, y] = pointIn(e, sellBtn);
    floatText(x, y, '+' + cash(v), 'cash');
    changed();
  });

  /* golden mango */
  let goldenAt = Date.now() + goldenDelay(game.s) * 1000;
  let golden: HTMLButtonElement | null = null;

  function spawnGolden() {
    const r = press.getBoundingClientRect();
    const g = fromHTML<HTMLButtonElement>(`<button class="golden" aria-label="Catch the golden mango">${GOLDEN_SVG}</button>`);
    g.style.left = `${Math.max(10, Math.random() * (r.width - 90))}px`;
    g.style.top = `${Math.max(10, Math.random() * (r.height - 110))}px`;
    g.addEventListener('click', () => {
      if (golden !== g) return;
      g.remove();
      golden = null;
      const bonus = catchGolden(game);
      if (bonus.kind === 'frenzy') toast('Mango Frenzy! Machines make 7× juice for 60 seconds.');
      else if (bonus.kind === 'rushHour') toast('Rush Hour! Juice sells for 3× the price for 60 seconds.');
      else if (bonus.kind === 'pulpRush') toast('Pulp Rush! Squeezes are worth 77× for 13 seconds.');
      else toast(`Windfall! Someone bought a whole crate for ${cash(bonus.amount)}.`);
      changed(true);
    });
    press.appendChild(g);
    golden = g;
    setTimeout(() => {
      if (golden === g) {
        g.remove();
        golden = null;
      }
    }, GOLDEN_LIFETIME_MS);
  }

  return {
    /** Called every frame: spawns a golden mango when one is due. */
    tick(now: number) {
      if (!golden && now > goldenAt && game.s.totalJuice > 30) {
        spawnGolden();
        goldenAt = now + goldenDelay(game.s) * 1000;
      }
    },

    render(now: number) {
      const s = game.s;
      const j = jps(game, now);
      const sr = shopRate(s);
      setText(els.perClick, '+' + vol(perClick(game, now)) + ' per squeeze' + (now < game.boosts.rushUntil ? ' · Pulp Rush' : ''));

      const cup = Math.min(s.juice, cupSize(s));
      setDisabled(sellBtn, cup <= 0);
      setText(els.sellVal, cup > 0 ? `${vol(cup)} for ${cash(cup * price(game, now))}` : 'Squeeze some juice first');

      let msg: string;
      let warn = false;
      if (sr <= 0) msg = 'No shops yet';
      else if (s.juice < sr * 0.5 && j < sr) {
        msg = `Shops need more juice (${Math.round((j / sr) * 100)}% busy)`;
        warn = true;
      } else if (j > sr * 1.5 && s.juice > sr * 30) {
        msg = 'Juice is piling up. Build more shops!';
        warn = true;
      } else msg = `Shops sell ${vol(sr)}/s`;
      setText(els.shopStatus, msg);
      els.shopStatus.classList.toggle('warn', warn);

      // The tank fills as you save towards the next thing you can't afford yet.
      const target = savingFor(s);
      const pct = Math.min(1, s.money / target.cost);
      const height = `${Math.round(pct * 820) / 10}%`;
      if (els.liquid.style.height !== height) els.liquid.style.height = height;
      setText(els.tankName, 'Saving for: ' + target.name);
      setText(els.tankPct, pct >= 1 ? 'Ready!' : `${Math.floor(pct * 100)}%`);
    },
  };
}
