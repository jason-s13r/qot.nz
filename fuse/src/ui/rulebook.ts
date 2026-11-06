// The rulebook panel beside the inbox. Tabs unlock as the week goes on.

import { CODES, CRL, DOSSIER, activeCodes, parseLit, type Context } from '../game/rules';
import { $, esc } from './dom';

type Tab = 'rules' | 'map' | 'decoder' | 'dossier' | 'certs' | 'bus';

export interface RulebookView {
  /** Rules in play (5 for endless). */
  day: number;
  endless: boolean;
  ctx: Context;
}

const DECODER_HINT = 'hex 0x… · octal 0o… · binary 0b… · decimal';

/** Tabs that get a "new" dot on the day they unlock. */
function isNewTab(k: Tab, v: RulebookView) {
  if (v.endless) return false;
  return (k === 'dossier' && v.day === 3) || (k === 'certs' && v.day === 4) || (k === 'bus' && v.day === 5) || (k === 'decoder' && v.day === 2);
}

function panel(tab: Tab, v: RulebookView): string {
  const { day, ctx } = v;
  const isNewCode = (c: keyof typeof CODES) => !v.endless && CODES[c].day === day && day > 1;
  switch (tab) {
    case 'rules':
      return `<p class="dim">Accept honest packets. Reject hostile ones with a reason. A packet breaking any rule below is hostile.</p>
        <ol class="rules">${activeCodes(day).map((c) => `<li>${isNewCode(c) ? '<span class="tag">NEW</span> ' : ''}<span class="code">${CODES[c].label}</span> ${CODES[c].desc}</li>`).join('')}</ol>
        <p class="dim small">Keys: <kbd>A</kbd> accept · <kbd>R</kbd> reject${day >= 2 || v.endless ? ' · <kbd>H</kbd> honeypot' : ''}</p>`;
    case 'map':
      return `<div class="memmap">
          <div class="mm-bar"><div class="mm-user">USERLAND<br><small>0x00–0x7F · open</small></div><div class="mm-kern">KERNEL<br><small>0x80–0xFF · signature</small><span class="mm-fuse" title="0xAC">0xAC</span></div></div>
          <div class="mm-oob">0x100 and up: <b>does not exist</b></div>
        </div>
        <table class="kv"><tr><td>Fuse address</td><td>0xAC = 172</td></tr><tr><td>Fuse value</td><td>172 = 0xAC${day >= 2 ? ' = 0o254 = 0b10101100' : ''}</td></tr><tr><td>Byte range</td><td>0–255 · 0x00–0xFF</td></tr></table>`;
    case 'decoder':
      return `<label class="dec-l" for="dec-in">Type a literal</label>
        <input id="dec-in" class="dec-in" spellcheck="false" autocomplete="off" placeholder="0xAC, 0o254, 0b1010…">
        <div id="dec-out" class="dec-out dim">${DECODER_HINT}</div>`;
    case 'dossier':
      return `<p class="dim">Known authors and their key fingerprints.</p><table class="kv">${Object.entries(DOSSIER).map(([a, k]) => `<tr><td>${a}</td><td><b>${k}</b></td></tr>`).join('')}</table><p class="dim small">Anyone not listed is unknown.</p>`;
    case 'certs':
      return `<table class="kv"><tr><td>Today</td><td><b>${ctx.date}</b></td></tr><tr><td>Trusted CA</td><td><b>QOT-ROOT</b></td></tr></table>
        <p class="dim">Revocation list</p><table class="kv">${CRL.map((s) => `<tr><td>serial</td><td><b>${s}</b></td></tr>`).join('')}</table>
        <p class="dim small">Watch for look-alikes: zero vs letter O.</p>`;
    case 'bus':
      return `<table class="kv"><tr><td>Today’s grant</td><td><b>${esc(ctx.grant)}</b></td></tr><tr><td>Forbidden</td><td>any range including <b>0xAC</b></td></tr></table>`;
  }
}

function wireDecoder() {
  const inp = $<HTMLInputElement>('#dec-in');
  const out = $('#dec-out');
  inp.addEventListener('input', () => {
    const r = parseLit(inp.value);
    if (!inp.value.trim()) {
      out.className = 'dec-out dim';
      out.textContent = DECODER_HINT;
      return;
    }
    if (r.type !== 'int') {
      out.className = 'dec-out bad';
      out.textContent = r.type === 'string' ? 'string — not a number' : r.type === 'float' ? 'decimal — not a whole number' : 'not a literal';
      return;
    }
    out.className = 'dec-out' + (r.n === 172 ? ' hit' : r.n > 255 ? ' bad' : '');
    out.innerHTML = `<b>${r.n}</b> · 0x${r.n.toString(16).toUpperCase()} · 0o${r.n.toString(8)} · 0b${r.n.toString(2)}${r.n > 255 ? ' · <b>out of range</b>' : ''}${r.n === 172 ? ' · <b>that’s the fuse</b>' : ''}`;
  });
}

export function mountRulebook(tabsEl: HTMLElement, panelsEl: HTMLElement) {
  let current: Tab = 'rules';
  let view: RulebookView | null = null;

  function render() {
    if (!view) return;
    const tabs: [Tab, string][] = [['rules', 'RULES'], ['map', 'MAP'], ['decoder', 'DECODER']];
    if (view.day >= 3) tabs.push(['dossier', 'DOSSIER']);
    if (view.day >= 4) tabs.push(['certs', 'CERTS']);
    if (view.day >= 5) tabs.push(['bus', 'BUS']);
    tabsEl.innerHTML = tabs
      .map(([k, l]) => `<button role="tab" aria-selected="${k === current}" data-tab="${k}">${l}${isNewTab(k, view!) ? '<i class="dot"></i>' : ''}</button>`)
      .join('');
    panelsEl.innerHTML = panel(current, view);
    if (current === 'decoder') wireDecoder();
  }

  tabsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!b) return;
    current = b.dataset.tab as Tab;
    render();
  });

  return {
    /** Shows the rulebook for a new day, back on the RULES tab. */
    show(v: RulebookView) {
      view = v;
      current = 'rules';
      render();
    },
  };
}
