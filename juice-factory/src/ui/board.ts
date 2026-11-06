// The order board: levels, one-off upgrades, and machines and shops.

import { LV, MACH, SHOPS, U, type Building, type Side } from '../game/content';
import { STORE, buyBuilding, buyLevel, buyUpgrade, bulkCost, bulkDisc, lv, lvCost, machEach, shopEach } from '../game/economy';
import { cash, vol } from '../game/format';
import type { Game } from '../game/state';
import { byId, fromHTML, q, setAttr, setDisabled, setHidden, setText } from './dom';
import { toast } from './toast';

const tag = (side: Side) => (side === 'juice' ? '<em class="tag">Squeeze</em>' : '<em class="tag shop">Shop</em>');

interface BuildingCard {
  b: Building;
  side: Side;
  el: HTMLButtonElement;
  name: HTMLElement;
  desc: HTMLElement;
  rate: HTMLElement;
  cost: HTMLElement;
  own: HTMLElement;
  ico: HTMLElement;
}

export function mountBoard(game: Game, changed: () => void) {
  let qty = 1;

  /* machines and shops, interleaved by price */
  const cards: Record<Side, BuildingCard[]> = { juice: [], sell: [] };
  for (const [side, items] of [['juice', MACH], ['sell', SHOPS]] as const) {
    for (const b of items) {
      const el = fromHTML<HTMLButtonElement>(
        `<button class="bld${side === 'sell' ? ' shop' : ''}">${tag(side)}<span class="ico" aria-hidden="true">${b.ico}</span>` +
          `<span class="nm"><b></b><small class="d"></small><small class="r"></small><small class="cost"></small></span><span class="own">0</span></button>`,
      );
      el.addEventListener('click', () => {
        if (buyBuilding(game.s, side, b, qty)) changed();
      });
      cards[side].push({ b, side, el, name: q(el, 'b'), desc: q(el, '.d'), rate: q(el, '.r'), cost: q(el, '.cost'), own: q(el, '.own'), ico: q(el, '.ico') });
    }
  }
  const list = byId('list');
  [...cards.juice, ...cards.sell].sort((a, b) => a.b.base - b.b.base).forEach((c) => list.appendChild(c.el));

  /* levels */
  const levels = LV.map((lvl) => {
    const el = fromHTML<HTMLButtonElement>(
      `<button class="upg side-${lvl.side}" hidden>${tag(lvl.side)}<b>${lvl.name} <em class="lvl">Lv 0</em></b>` +
        `<span class="now"></span><span>Next: ${lvl.next}</span><span class="c"></span></button>`,
    );
    el.addEventListener('click', () => {
      if (buyLevel(game.s, lvl)) changed();
    });
    return { lvl, el, badge: q<HTMLElement>(el, '.lvl'), now: q<HTMLElement>(el, '.now'), cost: q<HTMLElement>(el, '.c') };
  });
  const lvRoot = byId('lv');
  [...levels].sort((a, b) => a.lvl.base - b.lvl.base).forEach((l) => lvRoot.appendChild(l.el));

  /* one-off upgrades */
  const upRoot = byId('up');
  const upgrades = U.map((u) => {
    const el = fromHTML<HTMLButtonElement>(
      `<button class="upg side-${u.side}" hidden>${tag(u.side)}<b>${u.name}</b><span>${u.desc}</span><span class="c">${cash(u.cost)}</span></button>`,
    );
    el.addEventListener('click', () => {
      if (buyUpgrade(game.s, u)) {
        toast(`${u.name}: ${u.desc}`);
        changed();
      }
    });
    upRoot.appendChild(el);
    return { u, el };
  });
  const upEmpty = fromHTML<HTMLElement>('<div class="empty">More upgrades appear as you build machines and shops and sell juice.</div>');
  upRoot.appendChild(upEmpty);
  const upCount = byId('cnt');

  /* ×1 / ×10 / ×100 */
  const qtyButtons = [...document.querySelectorAll<HTMLButtonElement>('.qty button')];
  for (const btn of qtyButtons) {
    btn.addEventListener('click', () => {
      qty = Number(btn.dataset.q);
      for (const o of qtyButtons) o.setAttribute('aria-pressed', String(o === btn));
      changed();
    });
  }

  function renderBuildings(side: Side) {
    const s = game.s;
    const store = s[STORE[side]];
    let mystery = 0;
    cards[side].forEach((c, i) => {
      const own = store[c.b.id] || 0;
      // The next building along stays a mystery until you're close to affording it; anything past that is hidden.
      const known = own > 0 || i === 0 || (store[cards[side][i - 1].b.id] || 0) > 0 || s.money >= c.b.base * 0.6;
      if (!known && mystery >= 1) return setHidden(c.el, true);
      setHidden(c.el, false);
      if (!known) mystery++;
      c.el.classList.toggle('mystery', !known);
      setText(c.name, known ? c.b.name : '???');
      setText(c.ico, known ? c.b.ico : '?');
      const each = side === 'juice' ? machEach(s, c.b) : shopEach(s, c.b);
      setText(c.desc, known ? c.b.desc : 'Keep growing to find out.');
      setText(c.rate, known ? `${side === 'juice' ? 'Makes' : 'Sells'} ${vol(each)}/s each` : '???');
      const cost = bulkCost(c.b, own, qty);
      setText(c.cost, (qty > 1 ? `×${qty} for ` : '') + cash(cost) + (qty > 1 ? ` (${Math.round((1 - bulkDisc(qty)) * 100)}% off)` : ''));
      setText(c.own, own);
      setDisabled(c.el, s.money < cost);
      setAttr(c.el, 'aria-label', known ? `Buy ${qty} ${c.b.name} for ${cash(cost)}, you own ${own}` : 'Unknown');
    });
  }

  return function render() {
    const s = game.s;
    renderBuildings('juice');
    renderBuildings('sell');

    for (const l of levels) {
      const level = lv(s, l.lvl.id);
      const open = level > 0 || l.lvl.need(s);
      setHidden(l.el, !open);
      if (!open) continue;
      const cost = lvCost(s, l.lvl);
      const ok = s.money >= cost;
      setText(l.badge, 'Lv ' + level);
      setText(l.now, level ? 'Now: ' + l.lvl.eff(level) : 'Not bought yet');
      setText(l.cost, cash(cost));
      setDisabled(l.el, !ok);
      l.el.classList.toggle('ok', ok);
    }

    let visible = 0;
    let bought = 0;
    for (const { u, el } of upgrades) {
      if (s.upg[u.id]) {
        setHidden(el, true);
        bought++;
        continue;
      }
      const open = u.need(s);
      setHidden(el, !open);
      if (open) {
        visible++;
        const ok = s.money >= u.cost;
        setDisabled(el, !ok);
        el.classList.toggle('ok', ok);
      }
    }
    setHidden(upEmpty, visible > 0);
    setText(upCount, `${bought} of ${upgrades.length} bought`);
  };
}
