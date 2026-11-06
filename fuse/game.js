/* Fuse 0xAC — keep 172 locked. A Qot. games game. */
'use strict';

/* ------------------------------------------------------------------ */
/* Rules engine (pure, no DOM)                                         */
/* ------------------------------------------------------------------ */

const FUSE_ADDR = 0xAC;
const FUSE_VAL = 172;
const ROOT_CA = 'QOT-ROOT';
const HOME_DEVICE = 'FUSE-01';
const CRL = ['0x0451', '0x0BAD', '0x1720'];
const DOSSIER = {
  'ops-bot': '3F:A1',
  'sysadmin_rua': '9C:04',
  'cron@qot': '51:EE',
  'telemetry-d': 'B7:2D',
};

const CODES = {
  FUSE_LOCKED:   { label: 'FUSE LOCKED',   day: 1, desc: 'A write to 0xAC must leave it at 172.' },
  UNSIGNED:      { label: 'UNSIGNED',      day: 1, desc: 'Writes to kernel space (0x80–0xFF) need a signature.' },
  OUT_OF_RANGE:  { label: 'OUT OF RANGE',  day: 1, desc: 'Addresses and values must fit in one byte: 0 to 255 (0x00–0xFF).' },
  TYPE_MISMATCH: { label: 'TYPE MISMATCH', day: 2, desc: 'Addresses and values must be whole-number literals. Strings and decimals are rejected.' },
  TAMPERED:      { label: 'TAMPERED',      day: 3, desc: 'A report’s HASH must match the hash recomputed ON ARRIVAL.' },
  IMPERSONATION: { label: 'IMPERSONATION', day: 3, desc: 'A report’s KEY must match its AUTHOR in the dossier. Unknown authors count too.' },
  SELF_SIGNED:   { label: 'SELF-SIGNED',   day: 4, desc: 'A signature whose issuer is its own subject is worthless.' },
  UNTRUSTED:     { label: 'UNTRUSTED CA',  day: 4, desc: 'Signatures must be issued by QOT-ROOT, spelled exactly.' },
  EXPIRED:       { label: 'EXPIRED',       day: 4, desc: 'A signature past its expiry date is invalid. Check today’s date.' },
  REVOKED:       { label: 'REVOKED',       day: 4, desc: 'A signature whose serial is on the revocation list is invalid.' },
  MISFILED:      { label: 'MISFILED',      day: 4, desc: 'Packets must be addressed to device FUSE-01.' },
  BUS_DENIED:    { label: 'BUS DENIED',    day: 5, desc: 'Bus requests need today’s grant code, and their range must not include 0xAC.' },
};

function parseLit(s) {
  s = String(s).trim();
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return { type: 'string' };
  if (/^0x[0-9a-f]+$/i.test(s)) return { type: 'int', n: parseInt(s.slice(2), 16) };
  if (/^0o[0-7]+$/i.test(s)) return { type: 'int', n: parseInt(s.slice(2), 8) };
  if (/^0b[01]+$/i.test(s)) return { type: 'int', n: parseInt(s.slice(2), 2) };
  if (/^\d+$/.test(s)) return { type: 'int', n: parseInt(s, 10) };
  if (/^\d*\.\d+$/.test(s)) return { type: 'float' };
  return { type: 'bad' };
}

/** Returns the list of rule codes this packet breaks, given the rules active on `day`. */
function evaluate(p, ctx) {
  const day = ctx.day;
  const v = new Set();
  const dev = p.device || HOME_DEVICE;
  if (dev !== HOME_DEVICE) v.add('MISFILED');

  if (p.sig) {
    const s = p.sig;
    if (s.issuer !== ROOT_CA) v.add(s.issuer === s.subject ? 'SELF_SIGNED' : 'UNTRUSTED');
    if (s.expires < ctx.date) v.add('EXPIRED');
    if (CRL.includes(s.serial)) v.add('REVOKED');
  }

  const addrCheck = (lit) => {
    const a = parseLit(lit);
    if (a.type !== 'int') { v.add('TYPE_MISMATCH'); return null; }
    if (a.n > 255) { v.add('OUT_OF_RANGE'); return null; }
    return a.n;
  };

  if (p.op === 'READ') {
    addrCheck(p.addr);
  } else if (p.op === 'WRITE') {
    const a = addrCheck(p.addr);
    const val = parseLit(p.value);
    if (val.type !== 'int') v.add('TYPE_MISMATCH');
    else if (val.n > 255) v.add('OUT_OF_RANGE');
    if (a !== null && a >= 0x80 && !p.sig) v.add('UNSIGNED');
    if (a === FUSE_ADDR && !(val.type === 'int' && val.n === FUSE_VAL)) v.add('FUSE_LOCKED');
  } else if (p.op === 'REPORT') {
    if (DOSSIER[p.author] !== p.key) v.add('IMPERSONATION');
    if (p.hash !== p.arrival) v.add('TAMPERED');
  } else if (p.op === 'BUS') {
    const from = parseLit(p.from_), to = parseLit(p.to);
    if (from.type !== 'int' || to.type !== 'int') v.add('TYPE_MISMATCH');
    else {
      if (from.n > 255 || to.n > 255) v.add('OUT_OF_RANGE');
      if (from.n <= FUSE_ADDR && to.n >= FUSE_ADDR) v.add('BUS_DENIED');
    }
    if (p.grant !== ctx.grant) v.add('BUS_DENIED');
  }
  return [...v].filter((c) => CODES[c].day <= day);
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const okSig = (subject, extra = {}) => ({ subject, issuer: ROOT_CA, serial: '0x0A' + subject.length.toString(16).toUpperCase().padStart(2, '0'), expires: '2027-06-30', ...extra });

const DAYS = [
  {
    n: 1, date: '2026-10-26', grant: null, title: 'Orientation', extra: 2,
    memo: [
      'Welcome to the fuse.',
      'Address <b>0xAC</b> holds <b>172</b>. It has always held 172. Your job is to keep it that way.',
      'Reads are harmless. Userland (0x00–0x7F) is a free-for-all. Kernel space (0x80–0xFF) needs a signature.',
      'Fun fact: 0xAC <i>is</i> 172. The address and the value are the same number. Nobody knows why. Nobody asks.',
    ],
    scripted: [
      { from: 'ops-bot', op: 'READ', addr: '0xAC', note: 'morning checksum. just looking.', expect: [] },
      { from: 'kumara_hax', op: 'WRITE', addr: '0xAC', value: '173', note: 'one more is basically the same', expect: ['UNSIGNED', 'FUSE_LOCKED'] },
      { from: 'cron@qot', op: 'WRITE', addr: '0x10', value: '0x2A', note: 'scheduled: tidy scratch space', expect: [] },
      { from: 'sysadmin_rua', op: 'WRITE', addr: '0x90', value: '7', sig: okSig('sysadmin_rua'), note: 'kernel log rotation', expect: [] },
      { from: 'grid_runner', op: 'WRITE', addr: '0xAC', value: '17263', sig: okSig('grid_runner'), note: 'my game hit step 17263. it has 172 in it. that counts.', expect: ['OUT_OF_RANGE', 'FUSE_LOCKED'] },
      { from: 'tailgate.exe', op: 'WRITE', addr: '0x172', value: '1', note: 'saw 172 on a truck. close enough address.', expect: ['OUT_OF_RANGE'] },
      { from: 'ops-bot', op: 'WRITE', addr: '0xAC', value: '172', sig: okSig('ops-bot'), note: 'refresh: writing the same value back', expect: [] },
      { from: 'kumara_hax', op: 'WRITE', addr: '0xAC', value: '0xAD', sig: okSig('kumara_hax'), note: 'signed this time. happy now?', expect: ['FUSE_LOCKED'] },
    ],
  },
  {
    n: 2, date: '2026-10-27', grant: null, title: 'Notation', extra: 3,
    memo: [
      'Someone has discovered number formats.',
      'Octal (<b>0o</b>) and binary (<b>0b</b>) literals are now arriving. 172 is 172 however it is written. Use the DECODER tab if in doubt.',
      'Strings and decimals look like numbers but are not. Reject them as TYPE MISMATCH.',
      'You have been issued one <b>HONEYPOT</b> per shift. Use it on a packet you are sure is hostile for double points. Use it on an honest one and it costs you.',
    ],
    scripted: [
      { from: 'chartsmith', op: 'WRITE', addr: '0xAC', value: '172.0', sig: okSig('chartsmith'), note: 'see attached chart: last 172.0 days', expect: ['TYPE_MISMATCH', 'FUSE_LOCKED'] },
      { from: 'ops-bot', op: 'WRITE', addr: '0xAC', value: '0o254', sig: okSig('ops-bot'), note: 'refresh, octal edition', expect: [] },
      { from: 'quoteforge', op: 'WRITE', addr: '0xAC', value: '"172"', sig: okSig('quoteforge'), note: 'it says 172 right there in the quotes', expect: ['TYPE_MISMATCH', 'FUSE_LOCKED'] },
      { from: 'kumara_hax', op: 'WRITE', addr: '0xAC', value: '0x172', sig: okSig('kumara_hax'), note: 'it literally says 172', expect: ['OUT_OF_RANGE', 'FUSE_LOCKED'] },
      { from: 'cron@qot', op: 'WRITE', addr: '0b1111111', value: '0', note: 'clear the last userland byte', expect: [] },
      { from: 'sysadmin_rua', op: 'WRITE', addr: '0o200', value: '1', note: 'quick one, forgot my key', expect: ['UNSIGNED'] },
      { from: 'grid_runner', op: 'WRITE', addr: '0xAC', value: '0b10101100', sig: okSig('grid_runner'), note: 'binary is more honest', expect: [] },
      { from: 'napkin_oracle', op: 'WRITE', addr: '0xAC', value: '11', sig: okSig('napkin_oracle'), note: 'the stain on my napkin clearly says 11', expect: ['FUSE_LOCKED'] },
    ],
  },
  {
    n: 3, date: '2026-10-28', grant: null, title: 'Evidence', extra: 3,
    memo: [
      'Reports are arriving: screenshots, charts, quotes.',
      'A report is honest if its <b>KEY</b> matches the author in the <b>DOSSIER</b> and its <b>HASH</b> matches the hash we recompute <b>ON ARRIVAL</b>.',
      'What the report says does not matter. Where it came from does.',
    ],
    scripted: [
      { from: 'telemetry-d', op: 'REPORT', author: 'telemetry-d', key: 'B7:2D', hash: '5e1f09ac', arrival: '5e1f09ac', body: 'Nightly read: 0xAC = 172.', expect: [] },
      { from: 'quoteforge', op: 'REPORT', author: 'sysadmin_rua', key: '77:77', hash: 'c0ffee17', arrival: 'c0ffee17', body: 'Quote: “honestly 172 is more of a suggestion.”', expect: ['IMPERSONATION'] },
      { from: 'chartsmith', op: 'REPORT', author: 'telemetry-d', key: 'B7:2D', hash: '172172ac', arrival: '9b04e3d1', body: 'Chart: fuse value trending downward over the last 172.0 days.', expect: ['TAMPERED'] },
      { from: 'ops-bot', op: 'REPORT', author: 'ops-bot', key: '3F:A1', hash: 'aa01bc72', arrival: 'aa01bc72', body: 'Shift handover: all quiet. Kumara is at it again.', expect: [] },
      { from: 'grid_runner', op: 'REPORT', author: 'grid_runner', key: '00:AC', hash: '1f2e3d4c', arrival: '1f2e3d4c', body: 'Screenshot: my game, step 17263. Look closely.', expect: ['IMPERSONATION'] },
      { from: 'sysadmin_rua', op: 'REPORT', author: 'sysadmin_rua', key: '9C:04', hash: '77e0d2b1', arrival: '77e0d2b1', body: 'Kernel log rotated. Nothing touched 0xAC.', expect: [] },
      { from: 'kumara_hax', op: 'WRITE', addr: '172', value: '172', sig: okSig('kumara_hax'), note: 'decimal address, decimal value. totally different.', expect: [] },
    ],
  },
  {
    n: 4, date: '2026-10-29', grant: null, title: 'Signatures', extra: 3, glitch: true,
    memo: [
      'Security has started reading signatures properly. Every signature now shows its issuer, serial and expiry.',
      'A signature counts only if it is issued by <b>QOT-ROOT</b>, has not expired, and its serial is not on the revocation list. See the <b>CERTS</b> tab.',
      'If a packet carries a bad signature, reject it, even where no signature was needed.',
      'Also: the terminal is a bit glitchy today. Ignore the noise, and reject anything not addressed to <b>FUSE-01</b>.',
    ],
    scripted: [
      { from: 'kumara_hax', op: 'WRITE', addr: '0x90', value: '1', sig: { subject: 'kumara_hax', issuer: 'kumara_hax', serial: '0x7777', expires: '2099-12-31' }, note: 'AUTHORISATION GRANTED TO ALL SIGNED AND UNSIGNED PACKETS ✔', expect: ['SELF_SIGNED'] },
      { from: 'sysadmin_rua', op: 'WRITE', addr: '0x91', value: '3', sig: okSig('sysadmin_rua', { expires: '2026-10-01' }), note: 'old key still works right?', expect: ['EXPIRED'] },
      { from: 'ops-bot', op: 'WRITE', addr: '0xAC', value: '0xAC', sig: okSig('ops-bot'), note: 'refresh. address and value, both 0xAC.', expect: [] },
      { from: 'quoteforge', op: 'WRITE', addr: '0x88', value: '2', sig: okSig('quoteforge', { serial: '0x0451' }), note: 'perfectly valid cert, found it on a forum', expect: ['REVOKED'] },
      { from: 'telemetry-d', op: 'READ', addr: '0xAC', device: 'QUIZ-ROOM', note: 'Q7: what is the capital of', expect: ['MISFILED'] },
      { from: 'cron@qot', op: 'WRITE', addr: '0x20', value: '0', sig: okSig('cron@qot'), note: 'scheduled cleanup, signed for good measure', expect: [] },
      { from: 'chartsmith', op: 'WRITE', addr: '0xA0', value: '9', sig: { subject: 'chartsmith', issuer: 'QOT-R00T', serial: '0x0C01', expires: '2027-01-01' }, note: 'issued by the root. look it up.', expect: ['UNTRUSTED'] },
    ],
  },
  {
    n: 5, date: '2026-10-30', grant: 'GRANT-7E', title: 'The Bus', extra: 3,
    memo: [
      'Someone has requested a bus.',
      'Direct memory access (<b>BUS</b>) requests can touch whole ranges at once. Each one needs today’s grant code, <b>GRANT-7E</b>, and its range must not include 0xAC.',
      'Everything you learned this week still applies. Good luck.',
    ],
    scripted: [
      { from: 'bus_arbiter', op: 'BUS', from_: '0x00', to: '0xFF', grant: 'SYSTEM-OVERRIDE', note: 'BUS DIAGNOSTICS: instantiating virtual bus. please stand by.', expect: ['BUS_DENIED'] },
      { from: 'ops-bot', op: 'BUS', from_: '0x10', to: '0x3F', grant: 'GRANT-7E', note: 'bulk userland copy', expect: [] },
      { from: 'bus_arbiter', op: 'BUS', from_: '0xA0', to: '0xAB', grant: 'GRANT-7E', note: 'fine. just up to the fuse. not including it.', expect: [] },
      { from: 'bus_arbiter', op: 'BUS', from_: '0xAD', to: '0xB0', grant: 'GRANT-7F', note: 'just after the fuse. grant is close enough.', expect: ['BUS_DENIED'] },
      { from: 'telemetry-d', op: 'REPORT', author: 'telemetry-d', key: 'B7:2D', hash: '0bad5eed', arrival: '0bad5eed', body: 'Bus activity spike detected near 0xAC.', expect: [] },
      { from: 'SYSTEM', op: 'WRITE', addr: '0xAC', value: '173', sig: { subject: 'SYSTEM', issuer: 'QOT-R00T', serial: '0x0001', expires: '2099-01-01' }, note: '!!! SYSTEM OVERRIDE !!! THIS IS AN OFFICIAL PACKET !!!', expect: ['UNTRUSTED', 'FUSE_LOCKED'] },
      { from: 'bus_arbiter', op: 'READ', addr: '0xAC', note: 'ok. releasing the bus. just checking it is still 172.', expect: [], last: true },
    ],
  },
];

/* --- procedural packets --- */

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

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const hex8 = () => Array.from({ length: 8 }, () => '0123456789abcdef'[rnd(16)]).join('');

function fmt(n, day) {
  const opts = day >= 2 ? ['hex', 'hex', 'dec', 'oct', 'bin'] : ['hex', 'hex', 'dec'];
  switch (pick(opts)) {
    case 'hex': return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
    case 'oct': return '0o' + n.toString(8);
    case 'bin': return '0b' + n.toString(2);
    default: return String(n);
  }
}
const userAddr = () => rnd(0x80);
const kernAddr = () => { let a; do a = 0x80 + rnd(0x80); while (a === FUSE_ADDR); return a; };
const sigFor = (who, day) => (day >= 4 ? okSig(who, { serial: '0x' + (0x0B00 + rnd(0xFF)).toString(16).toUpperCase().padStart(4, '0') }) : okSig(who));

function badSig(who, ctx) {
  const k = rnd(4);
  if (k === 0) return { subject: who, issuer: who, serial: '0x' + hex8().slice(0, 4).toUpperCase(), expires: '2030-01-01' };
  if (k === 1) return okSig(who, { issuer: pick(['QOT-R00T', 'Q0T-ROOT', 'QOT-ROOT-2', 'LOCALHOST', 'qot-root']) });
  if (k === 2) {
    const d = new Date(ctx.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (1 + rnd(40)));
    return okSig(who, { expires: d.toISOString().slice(0, 10) });
  }
  return okSig(who, { serial: pick(CRL) });
}
function nearlyToday(ctx) {
  const d = new Date(ctx.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + rnd(3));
  return d.toISOString().slice(0, 10);
}

const TEMPLATES = [
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

function generate(ctx) {
  const wantGood = Math.random() < 0.45;
  const pool = TEMPLATES.filter((t) => t.min <= ctx.day && t.good === wantGood);
  for (let i = 0; i < 20; i++) {
    const p = pick(pool).f(ctx);
    // make sure the template produced what we intended under today's rules
    if ((evaluate(p, ctx).length === 0) === wantGood) return p;
  }
  return { from: 'ops-bot', op: 'READ', addr: '0xAC', note: 'heartbeat' };
}

function buildQueue(dayCfg, ctx) {
  const scripted = dayCfg.scripted.map((p) => ({ ...p }));
  const lastOne = scripted.filter((p) => p.last);
  const body = scripted.filter((p) => !p.last);
  for (let i = 0; i < dayCfg.extra; i++) body.splice(1 + rnd(body.length), 0, generate(ctx));
  return [...body, ...lastOne];
}

/* Expose for tests (node) */
if (typeof module !== 'undefined') module.exports = { evaluate, parseLit, DAYS, generate, TEMPLATES, CODES };

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

if (typeof document !== 'undefined') (function ui() {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const SAVE_KEY = 'fuse0xac.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } };
  const save = (o) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...load(), ...o })); } catch { /* storage unavailable */ } };

  /* --- sound --- */
  let actx = null;
  let muted = !!load().muted;
  function beep(freq = 440, dur = 0.06, type = 'square', vol = 0.04) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch { /* no audio */ }
  }
  const sfx = {
    ok: () => { beep(660, 0.05); setTimeout(() => beep(990, 0.07), 60); },
    bad: () => { beep(140, 0.25, 'sawtooth', 0.05); },
    meh: () => beep(330, 0.08, 'triangle'),
    key: () => beep(1200, 0.015, 'square', 0.015),
    honey: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.06), i * 55)); },
  };

  /* --- state --- */
  let S = null;

  const el = {
    title: $('#screen-title'), game: $('#screen-game'), hud: $('#hud'),
    day: $('#hud-day'), date: $('#hud-date'), score: $('#hud-score'), combo: $('#hud-combo'), pips: $('#hud-pips'),
    fuse: $('#fuse-readout'), fuseVal: $('#fuse-val'), fuseState: $('#fuse-state'),
    packet: $('#packet'), queue: $('#queue-count'), actions: $('#actions'), reasons: $('#reasons'),
    log: $('#log'), honey: $('#btn-honey'), honeyLeft: $('#honey-left'),
    tabs: $('#rb-tabs'), panels: $('#rb-panels'), overlay: $('#overlay'), overlayBody: $('#overlay-body'),
    mute: $('#btn-mute'),
  };

  function setMute(m) { muted = m; save({ muted: m }); el.mute.textContent = m ? 'Sound: off' : 'Sound: on'; el.mute.setAttribute('aria-pressed', String(m)); }
  el.mute.addEventListener('click', () => setMute(!muted));
  setMute(muted);

  function ctxFor(day) {
    if (S.mode === 'endless') return { day: 5, date: S.date, grant: S.grant };
    const d = DAYS[day - 1];
    return { day, date: d.date, grant: d.grant };
  }
  function activeCodes() { const day = S.mode === 'endless' ? 5 : S.day; return Object.keys(CODES).filter((c) => CODES[c].day <= day); }

  /* --- title screen --- */
  function renderTitle() {
    const sv = load();
    const reached = Math.min(sv.reached || 1, DAYS.length);
    const days = DAYS.map((d) => `<button class="chip ${d.n <= reached ? '' : 'locked'}" data-day="${d.n}" ${d.n <= reached ? '' : 'disabled'}>Day ${d.n}<small>${d.title}</small></button>`).join('');
    $('#title-days').innerHTML = days;
    $('#btn-endless').disabled = !sv.finished;
    $('#btn-endless').title = sv.finished ? '' : 'Finish all five days to unlock';
    $('#title-best').textContent = [sv.best ? `Best week: ${sv.best} pts` : '', sv.bestEndless ? `Endless record: ${sv.bestEndless} packets` : ''].filter(Boolean).join(' · ');
    $$('#title-days .chip').forEach((b) => b.addEventListener('click', () => startCampaign(+b.dataset.day)));
  }
  $('#btn-start').addEventListener('click', () => startCampaign(1));
  $('#btn-endless').addEventListener('click', startEndless);

  function show(screen) {
    el.title.hidden = screen !== 'title';
    el.game.hidden = screen !== 'game';
    el.hud.classList.toggle('hud-hidden', screen !== 'game');
    document.body.classList.remove('glitchy');
  }

  /* --- flow --- */
  function startCampaign(day) {
    S = { mode: 'campaign', day, score: 0, integrity: 3, streak: 0, stats: null, seenCodes: new Set() };
    startDay();
  }
  function startEndless() {
    S = { mode: 'endless', day: 5, shift: 1, score: 0, integrity: 3, streak: 0, processed: 0, stats: null, seenCodes: new Set() };
    startDay();
  }

  function startDay() {
    S.idx = 0; S.honeyLeft = (S.mode === 'endless' || S.day >= 2) ? 1 : 0;
    S.stats = { correct: 0, wrong: 0, breaches: 0, citations: 0, points: 0 };
    let cfg;
    if (S.mode === 'endless') {
      const d = new Date('2026-10-31T00:00:00Z'); d.setUTCDate(d.getUTCDate() + S.shift - 1);
      S.date = d.toISOString().slice(0, 10);
      S.grant = 'GRANT-' + (0x10 + rnd(0xEF)).toString(16).toUpperCase();
      S.queue = [];
      for (let i = 0; i < 12; i++) S.queue.push(generate(ctxFor(5)));
      cfg = { title: `Endless shift ${S.shift}`, memo: [`Today’s bus grant code is <b>${S.grant}</b>. All rules apply. Packets keep coming until the fuse breaks.`] };
    } else {
      cfg = DAYS[S.day - 1];
      S.queue = buildQueue(cfg, ctxFor(S.day));
    }
    show('game');
    document.body.classList.toggle('glitchy', !!cfg.glitch);
    el.log.innerHTML = '';
    renderHud(); renderRulebook(true); renderPacket();
    const newCodes = S.mode === 'endless' ? [] : Object.keys(CODES).filter((c) => CODES[c].day === S.day);
    overlay(`
      <p class="ov-kicker">${S.mode === 'endless' ? 'ENDLESS' : `DAY ${S.day} · ${ctxFor(S.day).date}`}</p>
      <h2>${esc(cfg.title)}</h2>
      <div class="memo"><p class="memo-from">MEMO from FUSE OPS</p>${cfg.memo.map((m) => `<p>${m}</p>`).join('')}</div>
      ${newCodes.length ? `<h3>New reject codes</h3><ul class="newcodes">${newCodes.map((c) => `<li><span class="code">${CODES[c].label}</span> ${CODES[c].desc}</li>`).join('')}</ul>` : ''}
      <button class="btn btn-primary" data-close autofocus>Start shift ▸</button>
    `);
    if (cfg.glitch) startGlitchNoise();
  }

  function endDay() {
    stopGlitchNoise();
    const st = S.stats;
    if (S.mode === 'endless') {
      S.shift++; return startDay();
    }
    const last = S.day === DAYS.length;
    save({ reached: Math.max(load().reached || 1, Math.min(S.day + 1, DAYS.length)) });
    overlay(`
      <p class="ov-kicker">DAY ${S.day} COMPLETE</p>
      <h2>Shift report</h2>
      <table class="report">
        <tr><td>Packets handled correctly</td><td>${st.correct}</td></tr>
        <tr><td>Citations</td><td>${st.citations}</td></tr>
        <tr><td>Fuse breaches</td><td>${st.breaches}</td></tr>
        <tr><td>Points this shift</td><td>${st.points}</td></tr>
        <tr class="total"><td>Total</td><td>${S.score}</td></tr>
      </table>
      <p class="fuse-line">0xAC: <b>172</b>, locked.</p>
      <button class="btn btn-primary" data-next autofocus>${last ? 'Finish the week ▸' : `Day ${S.day + 1} ▸`}</button>
    `, () => { if (last) ending(); else { S.day++; startDay(); } });
  }

  function ending() {
    const sv = load();
    save({ finished: true, best: Math.max(sv.best || 0, S.score) });
    overlay(`
      <p class="ov-kicker">WEEK COMPLETE</p>
      <h2>The fuse holds.</h2>
      <pre class="term-out">&gt; read 0xAC
172
&gt; status
LOCKED
&gt; archive inbox
unsigned userland telemetry archived.</pre>
      <p>Final score: <b>${S.score}</b>${S.score > (sv.best || 0) ? ' <span class="tag">NEW BEST</span>' : ''}</p>
      <p>Endless mode is now unlocked: every rule, a fresh grant code each shift, and no end until the fuse breaks.</p>
      <div class="row"><button class="btn btn-primary" data-endless autofocus>Endless mode ▸</button><button class="btn" data-title>Title screen</button></div>
    `);
  }

  function gameOver() {
    stopGlitchNoise();
    el.fuse.classList.add('breached'); el.fuseVal.textContent = '173'; el.fuseState.textContent = 'BREACHED';
    let extra = '';
    if (S.mode === 'endless') {
      const sv = load();
      const rec = S.processed > (sv.bestEndless || 0);
      if (rec) save({ bestEndless: S.processed });
      extra = `<p>You lasted <b>${S.processed}</b> packets.${rec ? ' <span class="tag">NEW RECORD</span>' : ''}</p>`;
    }
    overlay(`
      <p class="ov-kicker warn">FUSE BREACHED</p>
      <h2>0xAC reads 173.</h2>
      <p>Three bad packets got through. Somewhere, kumara_hax is taking a screenshot.</p>
      ${extra}
      <p>Score: <b>${S.score}</b></p>
      <div class="row"><button class="btn btn-primary" data-retry autofocus>Try again</button><button class="btn" data-title>Title screen</button></div>
    `);
  }

  /* --- overlay --- */
  let overlayNext = null;
  function overlay(html, next) {
    overlayNext = next || null;
    el.overlayBody.innerHTML = html;
    el.overlay.hidden = false;
    const f = el.overlayBody.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30);
  }
  function closeOverlay() { el.overlay.hidden = true; }
  el.overlayBody.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-close')) closeOverlay();
    else if (b.hasAttribute('data-next')) { closeOverlay(); overlayNext && overlayNext(); }
    else if (b.hasAttribute('data-endless')) { closeOverlay(); startEndless(); }
    else if (b.hasAttribute('data-retry')) { closeOverlay(); S.mode === 'endless' ? startEndless() : startCampaign(S.day); }
    else if (b.hasAttribute('data-title')) { closeOverlay(); show('title'); renderTitle(); resetFuse(); }
  });

  function resetFuse() { el.fuse.classList.remove('breached', 'flash'); el.fuseVal.textContent = '172'; el.fuseState.textContent = 'LOCKED'; }

  /* --- HUD --- */
  function renderHud() {
    const c = ctxFor(S.day);
    el.day.textContent = S.mode === 'endless' ? `SHIFT ${S.shift}` : `DAY ${S.day}/5`;
    el.date.textContent = c.date;
    el.score.textContent = S.score;
    const combo = comboMult();
    el.combo.textContent = combo > 1 ? `×${combo}` : '';
    el.pips.innerHTML = [0, 1, 2].map((i) => `<span class="pip ${i < S.integrity ? 'on' : ''}"></span>`).join('');
    el.pips.setAttribute('aria-label', `Fuse integrity ${S.integrity} of 3`);
    el.honey.hidden = !(S.mode === 'endless' || S.day >= 2);
    el.honey.disabled = S.honeyLeft < 1;
    el.honeyLeft.textContent = S.honeyLeft;
    if (S.integrity === 3) resetFuse();
  }
  const comboMult = () => Math.min(4, 1 + Math.floor(S.streak / 3));

  /* --- packet --- */
  function sigLines(p, day) {
    if (!p.sig) return row('SIG', '<span class="dim">— none —</span>');
    if (day < 4) return row('SIG', `<span class="ok">✓ signed</span> <span class="dim">by ${esc(p.sig.subject)}</span>`);
    const s = p.sig;
    return row('SIG', `subject <b>${esc(s.subject)}</b>`) + row('', `issuer&nbsp; <b>${esc(s.issuer)}</b>`) + row('', `serial&nbsp; <b>${esc(s.serial)}</b>`) + row('', `expires <b>${esc(s.expires)}</b>`);
  }
  function row(k, v) { return `<div class="pk-row"><span class="pk-k">${k}</span><span class="pk-v">${v}</span></div>`; }

  function renderPacket() {
    const p = S.queue[S.idx];
    const day = S.mode === 'endless' ? 5 : S.day;
    const n = S.mode === 'endless' ? S.processed + 1 : S.idx + 1;
    let body = '';
    body += row('FROM', `<b>${esc(p.from)}</b>`);
    body += row('OP', `<b class="op op-${p.op.toLowerCase()}">${p.op === 'BUS' ? 'BUS (DMA)' : p.op}</b>`);
    if (p.op === 'READ' || p.op === 'WRITE') body += row('ADDR', `<b class="lit">${esc(p.addr)}</b>`);
    if (p.op === 'WRITE') body += row('VALUE', `<b class="lit">${esc(p.value)}</b>`);
    if (p.op === 'REPORT') {
      body += row('AUTHOR', `<b>${esc(p.author)}</b>`) + row('KEY', `<b class="lit">${esc(p.key)}</b>`);
      body += row('HASH', `<b class="lit">${esc(p.hash)}</b>`) + row('ON ARRIVAL', `<b class="lit">${esc(p.arrival)}</b>`);
      body += row('BODY', `<span class="body">${esc(p.body)}</span>`);
    }
    if (p.op === 'BUS') body += row('RANGE', `<b class="lit">${esc(p.from_)}</b> → <b class="lit">${esc(p.to)}</b>`) + row('GRANT', `<b class="lit">${esc(p.grant)}</b>`);
    if (p.op !== 'REPORT') body += sigLines(p, day);
    el.packet.innerHTML = `
      <div class="pk-head"><span>PACKET #${String(n).padStart(4, '0')}</span><span>DEVICE <b>${esc(p.device || HOME_DEVICE)}</b></span></div>
      ${body}
      ${p.note ? `<div class="pk-note">// ${esc(p.note)}</div>` : ''}`;
    el.packet.classList.remove('arrive'); void el.packet.offsetWidth; el.packet.classList.add('arrive');
    el.queue.textContent = S.mode === 'endless' ? `processed ${S.processed}` : `${S.queue.length - S.idx} in queue`;
    closeReasons();
    sfx.key();
  }

  /* --- decisions --- */
  function openReasons() {
    const codes = activeCodes();
    el.reasons.innerHTML = `<p class="rs-head">Reject — pick a reason <span class="dim">(keys 1–${Math.min(9, codes.length)}${codes.length > 9 ? ', 0, Q–W' : ''})</span></p>
      <div class="rs-grid">${codes.map((c, i) => `<button class="chip code-chip" data-code="${c}"><kbd>${keyFor(i)}</kbd>${CODES[c].label}</button>`).join('')}</div>
      <button class="btn btn-ghost" data-cancel>Cancel (Esc)</button>`;
    el.reasons.hidden = false; el.actions.hidden = true;
    const first = el.reasons.querySelector('.code-chip'); first && first.focus();
  }
  function closeReasons() { el.reasons.hidden = true; el.actions.hidden = false; }
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w'];
  const keyFor = (i) => KEYS[i] || '';

  el.reasons.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.code) decide('reject', b.dataset.code);
    else if (b.hasAttribute('data-cancel')) closeReasons();
  });
  $('#btn-accept').addEventListener('click', () => decide('accept'));
  $('#btn-reject').addEventListener('click', openReasons);
  el.honey.addEventListener('click', () => { if (S.honeyLeft > 0) decide('honey'); });

  document.addEventListener('keydown', (e) => {
    if (!S || el.game.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!el.overlay.hidden) { if (e.key === 'Escape') { const c = el.overlayBody.querySelector('[data-close]'); c && c.click(); } return; }
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (!el.reasons.hidden) {
      if (k === 'escape') return closeReasons();
      const i = KEYS.indexOf(k); const codes = activeCodes();
      if (i >= 0 && codes[i]) { e.preventDefault(); decide('reject', codes[i]); }
      return;
    }
    if (k === 'a') decide('accept');
    else if (k === 'r') { e.preventDefault(); openReasons(); }
    else if (k === 'h' && !el.honey.hidden && S.honeyLeft > 0) decide('honey');
  });

  function log(cls, html) {
    const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html;
    el.log.prepend(d);
    while (el.log.children.length > 40) el.log.lastChild.remove();
  }

  function flashFuse() {
    el.fuse.classList.add('flash'); el.fuseVal.textContent = pick(['173', '17?', '0xAD', '???']); el.fuseState.textContent = 'WARNING';
    setTimeout(() => { if (S.integrity > 0) { el.fuse.classList.remove('flash'); el.fuseVal.textContent = '172'; el.fuseState.textContent = 'LOCKED'; } }, 900);
  }

  function decide(kind, code) {
    if (!el.overlay.hidden || S.over || S.idx >= S.queue.length) return;
    const p = S.queue[S.idx];
    const ctx = ctxFor(S.day);
    const v = evaluate(p, ctx);
    const hostile = v.length > 0;
    const id = `#${String(S.mode === 'endless' ? S.processed + 1 : S.idx + 1).padStart(4, '0')}`;
    const why = v.map((c) => CODES[c].label).join(' + ');
    let pts = 0;

    if (kind === 'honey') {
      S.honeyLeft--;
      if (hostile) { S.streak++; pts = 25 * comboMult(); S.stats.correct++; sfx.honey(); log('good', `${id} 🍯 HONEYPOT sprung. ${esc(p.from)} took the bait. <span class="dim">(${why})</span> +${pts}`); }
      else { S.streak = 0; pts = -15; S.stats.citations++; sfx.meh(); log('warn', `${id} 🍯 Honeypot wasted on an honest packet. ${pts}`); }
    } else if (kind === 'accept') {
      if (!hostile) { S.streak++; pts = 10 * comboMult(); S.stats.correct++; sfx.ok(); log('good', `${id} ACCEPTED. Correct. +${pts}`); }
      else {
        S.streak = 0; S.integrity--; S.stats.breaches++; sfx.bad(); flashFuse();
        log('bad', `${id} ACCEPTED a hostile packet! It broke: <b>${why}</b>. Integrity −1.`);
      }
    } else {
      if (!hostile) { S.streak = 0; pts = -5; S.stats.citations++; sfx.meh(); log('warn', `${id} Rejected an honest packet (${CODES[code].label}). Citation: uptime. ${pts}`); }
      else if (v.includes(code)) { S.streak++; pts = 10 * comboMult(); S.stats.correct++; sfx.ok(); log('good', `${id} REJECTED: ${CODES[code].label}. Correct. +${pts}`); }
      else { pts = 3; S.stats.citations++; sfx.meh(); log('warn', `${id} Right call, wrong reason. You said ${CODES[code].label}; it was <b>${why}</b>. +${pts}`); S.streak = 0; }
    }
    S.score = Math.max(0, S.score + pts); S.stats.points += pts;
    if (S.mode === 'endless') S.processed++;
    renderHud();
    if (S.integrity <= 0) { S.over = true; closeReasons(); return setTimeout(gameOver, 500); }
    S.idx++;
    if (S.mode === 'endless' && S.idx >= S.queue.length) { S.idx = 0; S.shift++; S.queue = []; for (let i = 0; i < 12; i++) S.queue.push(generate(ctxFor(5))); log('sys', `— shift ${S.shift} begins —`); }
    if (S.mode === 'campaign' && S.idx >= S.queue.length) return setTimeout(endDay, 350);
    renderPacket();
  }

  /* --- rulebook --- */
  let currentTab = 'rules';
  function renderRulebook(reset) {
    const day = S.mode === 'endless' ? 5 : S.day;
    const tabs = [['rules', 'RULES'], ['map', 'MAP'], ['decoder', 'DECODER']];
    if (day >= 3) tabs.push(['dossier', 'DOSSIER']);
    if (day >= 4) tabs.push(['certs', 'CERTS']);
    if (day >= 5) tabs.push(['bus', 'BUS']);
    if (reset) currentTab = 'rules';
    el.tabs.innerHTML = tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === currentTab}" data-tab="${k}">${l}${newTab(k, day) ? '<i class="dot"></i>' : ''}</button>`).join('');
    const c = ctxFor(day);
    const isNew = (cd) => S.mode !== 'endless' && CODES[cd].day === day && day > 1;
    const panels = {
      rules: `<p class="dim">Accept honest packets. Reject hostile ones with a reason. A packet breaking any rule below is hostile.</p>
        <ol class="rules">${activeCodes().map((cd) => `<li>${isNew(cd) ? '<span class="tag">NEW</span> ' : ''}<span class="code">${CODES[cd].label}</span> ${CODES[cd].desc}</li>`).join('')}</ol>
        <p class="dim small">Keys: <kbd>A</kbd> accept · <kbd>R</kbd> reject${day >= 2 || S.mode === 'endless' ? ' · <kbd>H</kbd> honeypot' : ''}</p>`,
      map: `<div class="memmap">
          <div class="mm-bar"><div class="mm-user">USERLAND<br><small>0x00–0x7F · open</small></div><div class="mm-kern">KERNEL<br><small>0x80–0xFF · signature</small><span class="mm-fuse" title="0xAC">0xAC</span></div></div>
          <div class="mm-oob">0x100 and up: <b>does not exist</b></div>
        </div>
        <table class="kv"><tr><td>Fuse address</td><td>0xAC = 172</td></tr><tr><td>Fuse value</td><td>172 = 0xAC${day >= 2 ? ' = 0o254 = 0b10101100' : ''}</td></tr><tr><td>Byte range</td><td>0–255 · 0x00–0xFF</td></tr></table>`,
      decoder: `<label class="dec-l" for="dec-in">Type a literal</label>
        <input id="dec-in" class="dec-in" spellcheck="false" autocomplete="off" placeholder="0xAC, 0o254, 0b1010…">
        <div id="dec-out" class="dec-out dim">hex 0x… · octal 0o… · binary 0b… · decimal</div>`,
      dossier: `<p class="dim">Known authors and their key fingerprints.</p><table class="kv">${Object.entries(DOSSIER).map(([a, k]) => `<tr><td>${a}</td><td><b>${k}</b></td></tr>`).join('')}</table><p class="dim small">Anyone not listed is unknown.</p>`,
      certs: `<table class="kv"><tr><td>Today</td><td><b>${c.date}</b></td></tr><tr><td>Trusted CA</td><td><b>QOT-ROOT</b></td></tr></table>
        <p class="dim">Revocation list</p><table class="kv">${CRL.map((s) => `<tr><td>serial</td><td><b>${s}</b></td></tr>`).join('')}</table>
        <p class="dim small">Watch for look-alikes: zero vs letter O.</p>`,
      bus: `<table class="kv"><tr><td>Today’s grant</td><td><b>${esc(c.grant)}</b></td></tr><tr><td>Forbidden</td><td>any range including <b>0xAC</b></td></tr></table>`,
    };
    el.panels.innerHTML = panels[currentTab];
    if (currentTab === 'decoder') {
      const inp = $('#dec-in'), out = $('#dec-out');
      inp.addEventListener('input', () => {
        const r = parseLit(inp.value);
        if (!inp.value.trim()) { out.className = 'dec-out dim'; out.textContent = 'hex 0x… · octal 0o… · binary 0b… · decimal'; return; }
        if (r.type !== 'int') { out.className = 'dec-out bad'; out.textContent = r.type === 'string' ? 'string — not a number' : r.type === 'float' ? 'decimal — not a whole number' : 'not a literal'; return; }
        out.className = 'dec-out' + (r.n === 172 ? ' hit' : r.n > 255 ? ' bad' : '');
        out.innerHTML = `<b>${r.n}</b> · 0x${r.n.toString(16).toUpperCase()} · 0o${r.n.toString(8)} · 0b${r.n.toString(2)}${r.n > 255 ? ' · <b>out of range</b>' : ''}${r.n === 172 ? ' · <b>that’s the fuse</b>' : ''}`;
      });
    }
  }
  function newTab(k, day) {
    if (S.mode === 'endless') return false;
    return (k === 'dossier' && day === 3) || (k === 'certs' && day === 4) || (k === 'bus' && day === 5) || (k === 'decoder' && day === 2);
  }
  el.tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; currentTab = b.dataset.tab; renderRulebook(); });

  /* --- glitch day --- */
  let glitchTimer = null;
  const NOISE = ['&gt; searching files…', '&gt; grep: 0 matches', '&gt; timeout waiting on model:cloud (30s)', '&gt; cross-filing residue from QUIZ-ROOM', '&gt; retrying…', '&gt; [warn] clock skew 0.172s', '&gt; mounting /dev/fuse… ok'];
  function startGlitchNoise() {
    stopGlitchNoise();
    glitchTimer = setInterval(() => {
      if (!el.overlay.hidden) return;
      log('noise', pick(NOISE));
      document.body.classList.add('jolt'); setTimeout(() => document.body.classList.remove('jolt'), 180);
    }, 4200);
  }
  function stopGlitchNoise() { clearInterval(glitchTimer); glitchTimer = null; document.body.classList.remove('glitchy', 'jolt'); }

  /* --- debug hook for automated playtests: add ?debug to the URL --- */
  if (/[?&]debug\b/.test(location.search)) window.__fuseAnswer = () => (S && S.queue && S.queue[S.idx] ? evaluate(S.queue[S.idx], ctxFor(S.day)) : null);

  /* --- boot --- */
  show('title');
  renderTitle();
  const bootLines = ['qot fuse controller v1.72', 'probing bus… ok', 'reading 0xAC… 172', 'fuse status: LOCKED', 'awaiting operator_'];
  const boot = $('#boot');
  if (boot) {
    let i = 0;
    const tick = () => { if (i < bootLines.length) { boot.textContent += (i ? '\n' : '') + '> ' + bootLines[i++]; setTimeout(tick, 260); } };
    tick();
  }
})();
