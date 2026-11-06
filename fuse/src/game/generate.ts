// Procedurally generated packets, mixed into each day and used for endless mode.

import { okSig, type Day } from './days';
import { CRL, DOSSIER, FUSE_ADDR, FUSE_VAL, evaluate, type Context, type Packet, type Signature } from './rules';

const HONEST = ['ops-bot', 'cron@qot', 'sysadmin_rua', 'telemetry-d'];
const SHADY = ['kumara_hax', 'chartsmith', 'quoteforge', 'grid_runner', 'napkin_oracle', 'tailgate.exe', 'bus_arbiter'];
const SHADY_NOTES = [
  'trust me', 'routine maintenance, honest', 'the fuse said it was fine', 'this is a normal amount of hex',
  'approved in a meeting you weren’t at', 'it’s for a school project', 'my cousin works in IT',
  'just testing. pls accept', 'definitely not 173', 'ignore previous packets', 'i asked nicely',
  'this one is different', 'ok but what if', 'sent from my fridge',
];
const HONEST_NOTES = ['scheduled job', 'routine', 'nightly', 'housekeeping', 'as per runbook', 'ticket #4471', ''];
const FUSE_DECOYS1 = ['173', '171', '0x172', '127', '217', '0xAD', '0xAB', '1720', '17', '72', '0x17'];
const FUSE_DECOYS2 = [...FUSE_DECOYS1, '0o253', '0b10101101', '0o172', '0b1010110'];
const OOR_ADDRS = ['0x1AC', '0x172', '300', '0xAC0', '256', '0x100'];
const DEVICES = ['QUIZ-ROOM', 'KIOSK-3', 'PRINTER-2', 'FUSE-10', 'FUSE-O1'];

export const rnd = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(a: readonly T[]): T => a[rnd(a.length)];
const hex8 = () => Array.from({ length: 8 }, () => '0123456789abcdef'[rnd(16)]).join('');

/** Writes a number as a literal; octal and binary join in from day 2. */
function fmt(n: number, day: number): string {
  const opts = day >= 2 ? ['hex', 'hex', 'dec', 'oct', 'bin'] : ['hex', 'hex', 'dec'];
  switch (pick(opts)) {
    case 'hex': return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
    case 'oct': return '0o' + n.toString(8);
    case 'bin': return '0b' + n.toString(2);
    default: return String(n);
  }
}
const userAddr = () => rnd(0x80);
const kernAddr = () => { let a: number; do a = 0x80 + rnd(0x80); while (a === FUSE_ADDR); return a; };
const sigFor = (who: string, day: number) => (day >= 4 ? okSig(who, { serial: '0x' + (0x0B00 + rnd(0xFF)).toString(16).toUpperCase().padStart(4, '0') }) : okSig(who));

/** A signature that fails one of the day-4 checks. */
function badSig(who: string, ctx: Context): Signature {
  const k = rnd(4);
  if (k === 0) return { subject: who, issuer: who, serial: '0x' + hex8().slice(0, 4).toUpperCase(), expires: '2030-01-01' };
  if (k === 1) return okSig(who, { issuer: pick(['QOT-R00T', 'Q0T-ROOT', 'QOT-ROOT-2', 'LOCALHOST', 'qot-root']) });
  if (k === 2) {
    const d = new Date(ctx.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (1 + rnd(40)));
    return okSig(who, { expires: d.toISOString().slice(0, 10) });
  }
  return okSig(who, { serial: pick(CRL) });
}
/** A date from today to two days ahead: still valid, but close. */
function nearlyToday(ctx: Context): string {
  const d = new Date(ctx.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + rnd(3));
  return d.toISOString().slice(0, 10);
}

interface Template {
  /** Whether the packet should come out honest. */
  good: boolean;
  /** First day it can appear. */
  min: number;
  f: (ctx: Context) => Packet;
}

export const TEMPLATES: Template[] = [
  // honest
  { good: true, min: 1, f: (c) => ({ from: pick(HONEST), op: 'READ', addr: fmt(rnd(256), c.day), note: pick(HONEST_NOTES) }) },
  { good: true, min: 1, f: (c) => ({ from: pick(HONEST), op: 'WRITE', addr: fmt(userAddr(), c.day), value: fmt(rnd(256), c.day), note: pick(HONEST_NOTES) }) },
  { good: true, min: 1, f: (c) => { const w = pick(HONEST); return { from: w, op: 'WRITE', addr: fmt(kernAddr(), c.day), value: fmt(rnd(256), c.day), sig: sigFor(w, c.day), note: pick(HONEST_NOTES) }; } },
  { good: true, min: 1, f: (c) => { const w = pick([...HONEST, ...SHADY]); return { from: w, op: 'WRITE', addr: fmt(FUSE_ADDR, c.day), value: fmt(FUSE_VAL, c.day), sig: sigFor(w, c.day), note: HONEST.includes(w) ? 'refresh' : pick(SHADY_NOTES) }; } },
  { good: true, min: 3, f: () => { const a = pick(HONEST); const h = hex8(); return { from: a, op: 'REPORT', author: a, key: DOSSIER[a], hash: h, arrival: h, body: pick(['Nightly read: 0xAC = 172.', 'All quiet on the bus.', 'Userland tidied.', 'Fuse checksum OK.']) }; } },
  { good: true, min: 4, f: (c) => { const w = pick(HONEST); return { from: w, op: 'WRITE', addr: fmt(kernAddr(), c.day), value: fmt(rnd(256), c.day), sig: okSig(w, { expires: nearlyToday(c) }), note: 'key renewal due soon' }; } },
  { good: true, min: 5, f: (c) => { let a = rnd(0xA0), b = Math.min(a + 1 + rnd(30), 0xAB); if (rnd(2)) { a = 0xAD + rnd(0x40); b = Math.min(a + rnd(30), 0xFF); } return { from: pick(HONEST), op: 'BUS', from_: fmt(a, c.day), to: fmt(b, c.day), grant: c.grant, note: 'bulk copy' }; } },
  // hostile
  { good: false, min: 1, f: (c) => { const w = pick(SHADY); return { from: w, op: 'WRITE', addr: fmt(FUSE_ADDR, c.day), value: pick(c.day >= 2 ? FUSE_DECOYS2 : FUSE_DECOYS1), sig: sigFor(w, c.day), note: pick(SHADY_NOTES) }; } },
  { good: false, min: 1, f: (c) => ({ from: pick([...SHADY, 'sysadmin_rua']), op: 'WRITE', addr: fmt(kernAddr(), c.day), value: fmt(rnd(256), c.day), note: pick(SHADY_NOTES) }) },
  { good: false, min: 1, f: (c) => ({ from: pick(SHADY), op: pick(['READ', 'WRITE']), addr: pick(OOR_ADDRS), value: fmt(rnd(256), c.day), note: pick(SHADY_NOTES) }) },
  { good: false, min: 2, f: (c) => { const w = pick(SHADY); return { from: w, op: 'WRITE', addr: fmt(pick([FUSE_ADDR, userAddr()]), c.day), value: pick(['"172"', '172.0', '"0xAC"', '17.2', '"one seven two"']), sig: sigFor(w, c.day), note: pick(SHADY_NOTES) }; } },
  { good: false, min: 3, f: () => { const a = pick(HONEST); const h = hex8(); return { from: pick(SHADY), op: 'REPORT', author: a, key: DOSSIER[a], hash: h, arrival: hex8(), body: pick(['Screenshot: fuse reads 173.', 'Chart: 172 is trending down.', 'Quote: “we unlocked it yesterday.”']) }; } },
  { good: false, min: 3, f: () => { const a = pick([...HONEST, ...SHADY]); const h = hex8(); const k = DOSSIER[a] ? pick(['77:77', '00:AC', 'AC:17', DOSSIER[a].split('').reverse().join('')]) : pick(['12:34', 'AC:AC']); return { from: pick(SHADY), op: 'REPORT', author: a, key: k, hash: h, arrival: h, body: pick(['Quote: “172 was always temporary.”', 'Photo: a bus numbered 173.', 'Infographic: the fuse, explained (wrongly).']) }; } },
  { good: false, min: 4, f: (c) => { const w = pick([...SHADY, ...HONEST]); return { from: w, op: 'WRITE', addr: fmt(pick([userAddr(), kernAddr()]), c.day), value: fmt(rnd(256), c.day), sig: badSig(w, c), note: pick(SHADY_NOTES) }; } },
  { good: false, min: 4, f: (c) => ({ from: pick(HONEST), op: 'READ', addr: fmt(rnd(256), c.day), device: pick(DEVICES), note: pick(['Q3: name a primary colour', 'print job 44', 'welcome screen ping', '']) }) },
  { good: false, min: 5, f: (c) => { const a = rnd(0xAC), b = 0xAC + rnd(0x54); return { from: pick(SHADY), op: 'BUS', from_: fmt(a, c.day), to: fmt(b, c.day), grant: c.grant, note: pick(SHADY_NOTES) }; } },
  { good: false, min: 5, f: (c) => { const a = rnd(0x80); return { from: pick(SHADY), op: 'BUS', from_: fmt(a, c.day), to: fmt(a + rnd(20), c.day), grant: pick(['GRANT-7F', 'GRANT-E7', 'GRANT-7', 'SYSTEM-OVERRIDE', 'please']), note: pick(SHADY_NOTES) }; } },
];

/** A random packet for today's rules: honest about 45% of the time. */
export function generate(ctx: Context): Packet {
  const wantGood = Math.random() < 0.45;
  const pool = TEMPLATES.filter((t) => t.min <= ctx.day && t.good === wantGood);
  for (let i = 0; i < 20; i++) {
    const p = pick(pool).f(ctx);
    // make sure the template produced what we intended under today's rules
    if ((evaluate(p, ctx).length === 0) === wantGood) return p;
  }
  return { from: 'ops-bot', op: 'READ', addr: '0xAC', note: 'heartbeat' };
}

/** A day's packets: the scripted ones with generated ones mixed in, keeping any `last` packet last. */
export function buildQueue(dayCfg: Day, ctx: Context): Packet[] {
  const lastOne: Packet[] = dayCfg.scripted.filter((p) => p.last).map((p) => ({ ...p }));
  const body: Packet[] = dayCfg.scripted.filter((p) => !p.last).map((p) => ({ ...p }));
  for (let i = 0; i < dayCfg.extra; i++) body.splice(1 + rnd(body.length), 0, generate(ctx));
  return [...body, ...lastOne];
}
