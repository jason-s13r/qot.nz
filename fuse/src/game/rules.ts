// The rules engine: what makes a packet hostile. Pure, no DOM.

export const FUSE_ADDR = 0xac;
export const FUSE_VAL = 172;
export const ROOT_CA = 'QOT-ROOT';
export const HOME_DEVICE = 'FUSE-01';
/** Revoked signature serials. */
export const CRL = ['0x0451', '0x0BAD', '0x1720'];
/** Known report authors and their key fingerprints. */
export const DOSSIER: Record<string, string> = {
  'ops-bot': '3F:A1',
  sysadmin_rua: '9C:04',
  'cron@qot': '51:EE',
  'telemetry-d': 'B7:2D',
};

export interface Code {
  label: string;
  /** The campaign day this rule starts applying. */
  day: number;
  desc: string;
}

export const CODES = {
  FUSE_LOCKED: { label: 'FUSE LOCKED', day: 1, desc: 'A write to 0xAC must leave it at 172.' },
  UNSIGNED: { label: 'UNSIGNED', day: 1, desc: 'Writes to kernel space (0x80–0xFF) need a signature.' },
  OUT_OF_RANGE: { label: 'OUT OF RANGE', day: 1, desc: 'Addresses and values must fit in one byte: 0 to 255 (0x00–0xFF).' },
  TYPE_MISMATCH: { label: 'TYPE MISMATCH', day: 2, desc: 'Addresses and values must be whole-number literals. Strings and decimals are rejected.' },
  TAMPERED: { label: 'TAMPERED', day: 3, desc: 'A report’s HASH must match the hash recomputed ON ARRIVAL.' },
  IMPERSONATION: { label: 'IMPERSONATION', day: 3, desc: 'A report’s KEY must match its AUTHOR in the dossier. Unknown authors count too.' },
  SELF_SIGNED: { label: 'SELF-SIGNED', day: 4, desc: 'A signature whose issuer is its own subject is worthless.' },
  UNTRUSTED: { label: 'UNTRUSTED CA', day: 4, desc: 'Signatures must be issued by QOT-ROOT, spelled exactly.' },
  EXPIRED: { label: 'EXPIRED', day: 4, desc: 'A signature past its expiry date is invalid. Check today’s date.' },
  REVOKED: { label: 'REVOKED', day: 4, desc: 'A signature whose serial is on the revocation list is invalid.' },
  MISFILED: { label: 'MISFILED', day: 4, desc: 'Packets must be addressed to device FUSE-01.' },
  BUS_DENIED: { label: 'BUS DENIED', day: 5, desc: 'Bus requests need today’s grant code, and their range must not include 0xAC.' },
} satisfies Record<string, Code>;

export type CodeId = keyof typeof CODES;
export const CODE_IDS = Object.keys(CODES) as CodeId[];

export interface Signature {
  subject: string;
  issuer: string;
  serial: string;
  /** ISO date, YYYY-MM-DD. */
  expires: string;
}

export type Op = 'READ' | 'WRITE' | 'REPORT' | 'BUS';

/** An incoming packet. Addresses and values are literals as written, e.g. "0xAC", "0o254", "\"172\"". */
export interface Packet {
  from: string;
  op: Op;
  note?: string;
  device?: string;
  sig?: Signature;
  /** READ, WRITE */
  addr?: string;
  /** WRITE */
  value?: string;
  /** REPORT */
  author?: string;
  key?: string;
  hash?: string;
  arrival?: string;
  body?: string;
  /** BUS range start (`from` is the sender). */
  from_?: string;
  /** BUS range end. */
  to?: string;
  grant?: string | null;
}

export interface Context {
  day: number;
  /** Today's date, ISO. */
  date: string;
  /** Today's bus grant code, from day 5. */
  grant: string | null;
}

export type Literal = { type: 'int'; n: number } | { type: 'string' } | { type: 'float' } | { type: 'bad' };

export function parseLit(s: unknown): Literal {
  const t = String(s).trim();
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return { type: 'string' };
  if (/^0x[0-9a-f]+$/i.test(t)) return { type: 'int', n: parseInt(t.slice(2), 16) };
  if (/^0o[0-7]+$/i.test(t)) return { type: 'int', n: parseInt(t.slice(2), 8) };
  if (/^0b[01]+$/i.test(t)) return { type: 'int', n: parseInt(t.slice(2), 2) };
  if (/^\d+$/.test(t)) return { type: 'int', n: parseInt(t, 10) };
  if (/^\d*\.\d+$/.test(t)) return { type: 'float' };
  return { type: 'bad' };
}

/** The rules this packet breaks, counting only those active on `ctx.day`. An empty list means it's honest. */
export function evaluate(p: Packet, ctx: Context): CodeId[] {
  const v = new Set<CodeId>();
  if ((p.device || HOME_DEVICE) !== HOME_DEVICE) v.add('MISFILED');

  if (p.sig) {
    const s = p.sig;
    if (s.issuer !== ROOT_CA) v.add(s.issuer === s.subject ? 'SELF_SIGNED' : 'UNTRUSTED');
    if (s.expires < ctx.date) v.add('EXPIRED');
    if (CRL.includes(s.serial)) v.add('REVOKED');
  }

  const addrCheck = (lit: unknown): number | null => {
    const a = parseLit(lit);
    if (a.type !== 'int') {
      v.add('TYPE_MISMATCH');
      return null;
    }
    if (a.n > 255) {
      v.add('OUT_OF_RANGE');
      return null;
    }
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
    if (DOSSIER[p.author ?? ''] !== p.key) v.add('IMPERSONATION');
    if (p.hash !== p.arrival) v.add('TAMPERED');
  } else if (p.op === 'BUS') {
    const from = parseLit(p.from_);
    const to = parseLit(p.to);
    if (from.type !== 'int' || to.type !== 'int') v.add('TYPE_MISMATCH');
    else {
      if (from.n > 255 || to.n > 255) v.add('OUT_OF_RANGE');
      if (from.n <= FUSE_ADDR && to.n >= FUSE_ADDR) v.add('BUS_DENIED');
    }
    if (p.grant !== ctx.grant) v.add('BUS_DENIED');
  }
  return [...v].filter((c) => CODES[c].day <= ctx.day);
}

/** Codes in play on a given day, in rulebook order. */
export const activeCodes = (day: number) => CODE_IDS.filter((c) => CODES[c].day <= day);
