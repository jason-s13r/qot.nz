// Number formatting for volumes, money and durations.

const UNITS: [string, number][] = [['EL', 1e21], ['PL', 1e18], ['TL', 1e15], ['GL', 1e12], ['ML', 1e9], ['kL', 1e6], ['L', 1e3]];
const MONEY: [string, number][] = [['Qa', 1e15], ['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]];

function trim(x: number): string {
  return x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : Math.floor(x).toString();
}

/** A volume given in mL, scaled up through L, kL, ML and so on. */
export function vol(v: number): string {
  if (!isFinite(v)) return '∞';
  if (v >= 1e24) return v.toExponential(2) + ' mL';
  for (const [n, u] of UNITS) if (v >= u) return trim(v / u) + ' ' + n;
  return (v < 10 && v % 1 ? v.toFixed(1) : Math.floor(v)) + ' mL';
}

/** A dollar amount, scaled up through K, M, B and so on. */
export function cash(v: number): string {
  if (!isFinite(v)) return '$∞';
  if (v >= 1e18) return '$' + v.toExponential(2);
  for (const [n, u] of MONEY) if (v >= u) return '$' + trim(v / u) + n;
  return '$' + (v < 100 ? v.toFixed(2) : Math.floor(v));
}

export function fmtMult(x: number): string {
  return x >= 1e6 ? x.toExponential(1) : x.toLocaleString();
}

export function dur(sec: number): string {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec % 60}s` : `${sec}s`;
}

/** Total of an `{ id: count }` map. */
export function count(o: Record<string, number>): number {
  return Object.values(o).reduce((a, b) => a + b, 0);
}
