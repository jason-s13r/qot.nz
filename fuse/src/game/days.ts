// The five-day campaign. Each scripted packet lists the codes it should break (`expect`);
// days.test.ts checks those against the rules engine, so a rule change that breaks a puzzle fails the tests.

import { ROOT_CA, type CodeId, type Packet, type Signature } from './rules';

export interface ScriptedPacket extends Packet {
  expect: CodeId[];
  /** Always the last packet of the day, after the generated ones. */
  last?: boolean;
}

export interface Day {
  n: number;
  /** In-game date, ISO. */
  date: string;
  grant: string | null;
  title: string;
  /** How many generated packets to mix in. */
  extra: number;
  /** Day 4's noisy terminal. */
  glitch?: boolean;
  /** Briefing paragraphs (HTML). */
  memo: string[];
  scripted: ScriptedPacket[];
}

/** A valid QOT-ROOT signature, with overrides. */
export const okSig = (subject: string, extra: Partial<Signature> = {}): Signature => ({ subject, issuer: ROOT_CA, serial: '0x0A' + subject.length.toString(16).toUpperCase().padStart(2, '0'), expires: '2027-06-30', ...extra });

export const DAYS: Day[] = [
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
