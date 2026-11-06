// The packet card in the inbox.

import { HOME_DEVICE, type Packet } from '../game/rules';
import { esc } from './dom';

const row = (k: string, v: string) => `<div class="pk-row"><span class="pk-k">${k}</span><span class="pk-v">${v}</span></div>`;

/** Before day 4 a signature is just "signed"; from day 4 you see its issuer, serial and expiry. */
function sigRows(p: Packet, day: number): string {
  if (!p.sig) return row('SIG', '<span class="dim">— none —</span>');
  if (day < 4) return row('SIG', `<span class="ok">✓ signed</span> <span class="dim">by ${esc(p.sig.subject)}</span>`);
  const s = p.sig;
  return (
    row('SIG', `subject <b>${esc(s.subject)}</b>`) +
    row('', `issuer&nbsp; <b>${esc(s.issuer)}</b>`) +
    row('', `serial&nbsp; <b>${esc(s.serial)}</b>`) +
    row('', `expires <b>${esc(s.expires)}</b>`)
  );
}

const lit = (v: unknown) => `<b class="lit">${esc(v)}</b>`;

export function packetHTML(p: Packet, n: number, day: number): string {
  let body = row('FROM', `<b>${esc(p.from)}</b>`);
  body += row('OP', `<b class="op op-${p.op.toLowerCase()}">${p.op === 'BUS' ? 'BUS (DMA)' : p.op}</b>`);
  if (p.op === 'READ' || p.op === 'WRITE') body += row('ADDR', lit(p.addr));
  if (p.op === 'WRITE') body += row('VALUE', lit(p.value));
  if (p.op === 'REPORT') {
    body += row('AUTHOR', `<b>${esc(p.author)}</b>`) + row('KEY', lit(p.key));
    body += row('HASH', lit(p.hash)) + row('ON ARRIVAL', lit(p.arrival));
    body += row('BODY', `<span class="body">${esc(p.body)}</span>`);
  }
  if (p.op === 'BUS') body += row('RANGE', `${lit(p.from_)} → ${lit(p.to)}`) + row('GRANT', lit(p.grant));
  if (p.op !== 'REPORT') body += sigRows(p, day);
  return `
      <div class="pk-head"><span>PACKET #${String(n).padStart(4, '0')}</span><span>DEVICE <b>${esc(p.device || HOME_DEVICE)}</b></span></div>
      ${body}
      ${p.note ? `<div class="pk-note">// ${esc(p.note)}</div>` : ''}`;
}
