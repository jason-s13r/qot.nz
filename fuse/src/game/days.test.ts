import { describe, expect, it } from 'vitest';
import { DAYS } from './days';
import { TEMPLATES, buildQueue, generate } from './generate';
import { CODES, evaluate, parseLit, type Context } from './rules';

const ctxFor = (n: number): Context => ({ day: n, date: DAYS[n - 1].date, grant: DAYS[n - 1].grant });

describe('parseLit', () => {
  it.each([
    ['0xAC', 172], ['0o254', 172], ['0b10101100', 172], ['172', 172], [' 0XAC ', 172],
  ])('reads %s as %i', (lit, n) => expect(parseLit(lit)).toEqual({ type: 'int', n }));

  it('rejects things that only look like numbers', () => {
    expect(parseLit('"172"').type).toBe('string');
    expect(parseLit('172.0').type).toBe('float');
    expect(parseLit('0xZZ').type).toBe('bad');
  });
});

describe('scripted days', () => {
  for (const day of DAYS) {
    describe(`day ${day.n}: ${day.title}`, () => {
      day.scripted.forEach((p, i) => {
        it(`packet ${i + 1} from ${p.from} breaks ${p.expect.join(' + ') || 'nothing'}`, () => {
          expect(new Set(evaluate(p, ctxFor(day.n)))).toEqual(new Set(p.expect));
        });
      });

      it('only expects codes that are active that day', () => {
        for (const p of day.scripted) for (const c of p.expect) expect(CODES[c].day).toBeLessThanOrEqual(day.n);
      });
    });
  }
});

describe('generated packets', () => {
  it('come out honest or hostile as the template intends', () => {
    for (let n = 1; n <= DAYS.length; n++) {
      const ctx = ctxFor(n);
      for (const t of TEMPLATES.filter((t) => t.min <= n)) {
        // Templates are random; most draws should match their intent, and generate() retries the rest.
        let matches = 0;
        for (let i = 0; i < 50; i++) if ((evaluate(t.f(ctx), ctx).length === 0) === t.good) matches++;
        expect(matches, `day ${n} template ${TEMPLATES.indexOf(t)}`).toBeGreaterThan(10);
      }
      for (let i = 0; i < 200; i++) expect(generate(ctx).op).toBeTruthy();
    }
  });

  it('build a queue with the scripted packets, the extras, and the last packet last', () => {
    for (const day of DAYS) {
      const q = buildQueue(day, ctxFor(day.n));
      expect(q.length).toBe(day.scripted.length + day.extra);
      const last = day.scripted.find((p) => p.last);
      if (last) expect(q.at(-1)).toMatchObject({ from: last.from, note: last.note });
    }
  });
});
