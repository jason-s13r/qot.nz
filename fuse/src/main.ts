
import { DAYS } from './game/days';
import { buildQueue, generate, pick, rnd } from './game/generate';
import { CODES, activeCodes, evaluate, type CodeId, type Context, type Packet } from './game/rules';
import { $, $$, esc } from './ui/dom';
import { mountOverlay } from './ui/overlay';
import { packetHTML } from './ui/packet';
import { mountRulebook } from './ui/rulebook';
import { mountMuteButton, sfx } from './ui/sound';
import { load, save } from './ui/storage';

const INTEGRITY = 3;
const ENDLESS_SHIFT = 12;
const ENDLESS_START = '2026-10-31';
/** Keys for picking a reject reason, in rulebook order. */
const REASON_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w'];

interface Run {
  mode: 'campaign' | 'endless';
  /** Campaign day; always 5 in endless. */
  day: number;
  /** Endless shift number. */
  shift: number;
  score: number;
  integrity: number;
  /** Correct calls in a row, for the combo multiplier. */
  streak: number;
  /** Packets handled in endless. */
  processed: number;
  queue: Packet[];
  idx: number;
  honeyLeft: number;
  date: string;
  grant: string | null;
  over: boolean;
  stats: { correct: number; breaches: number; citations: number; points: number };
}

const el = {
  title: $('#screen-title'),
  game: $('#screen-game'),
  hud: $('#hud'),
  day: $('#hud-day'),
  date: $('#hud-date'),
  score: $('#hud-score'),
  combo: $('#hud-combo'),
  pips: $('#hud-pips'),
  fuse: $('#fuse-readout'),
  fuseVal: $('#fuse-val'),
  fuseState: $('#fuse-state'),
  packet: $('#packet'),
  queue: $('#queue-count'),
  actions: $('#actions'),
  reasons: $('#reasons'),
  log: $('#log'),
  honey: $<HTMLButtonElement>('#btn-honey'),
  honeyLeft: $('#honey-left'),
};

let S: Run | null = null;
const run = () => S!;

const isEndless = () => run().mode === 'endless';
const rulesDay = () => (isEndless() ? 5 : run().day);
const comboMult = () => Math.min(4, 1 + Math.floor(run().streak / 3));
const packetNo = () => (isEndless() ? run().processed + 1 : run().idx + 1);

function ctx(): Context {
  if (isEndless()) return { day: 5, date: run().date, grant: run().grant };
  const d = DAYS[run().day - 1];
  return { day: d.n, date: d.date, grant: d.grant };
}

mountMuteButton($<HTMLButtonElement>('#btn-mute'));
const rulebook = mountRulebook($('#rb-tabs'), $('#rb-panels'));
const overlay = mountOverlay($('#overlay'), $('#overlay-body'), (action, next) => {
  if (action === 'next') next?.();
  else if (action === 'endless') startEndless();
  else if (action === 'retry') (isEndless() ? startEndless() : startCampaign(run().day));
  else if (action === 'title') {
    show('title');
    renderTitle();
    resetFuse();
  }
});

/* ---------- title screen ---------- */

function renderTitle() {
  const sv = load();
  const reached = Math.min(sv.reached || 1, DAYS.length);
  $('#title-days').innerHTML = DAYS.map(
    (d) => `<button class="chip ${d.n <= reached ? '' : 'locked'}" data-day="${d.n}" ${d.n <= reached ? '' : 'disabled'}>Day ${d.n}<small>${d.title}</small></button>`,
  ).join('');
  const endless = $<HTMLButtonElement>('#btn-endless');
  endless.disabled = !sv.finished;
  endless.title = sv.finished ? '' : 'Finish all five days to unlock';
  $('#title-best').textContent = [sv.best ? `Best week: ${sv.best} pts` : '', sv.bestEndless ? `Endless record: ${sv.bestEndless} packets` : '']
    .filter(Boolean)
    .join(' · ');
  for (const b of $$('#title-days .chip')) b.addEventListener('click', () => startCampaign(Number(b.dataset.day)));
}
$('#btn-start').addEventListener('click', () => startCampaign(1));
$('#btn-endless').addEventListener('click', startEndless);

function show(screen: 'title' | 'game') {
  el.title.hidden = screen !== 'title';
  el.game.hidden = screen !== 'game';
  el.hud.classList.toggle('hud-hidden', screen !== 'game');
  document.body.classList.remove('glitchy');
}

/* ---------- flow ---------- */

function newRun(mode: Run['mode'], day: number): Run {
  return {
    mode, day, shift: 1, score: 0, integrity: INTEGRITY, streak: 0, processed: 0, queue: [], idx: 0, honeyLeft: 0,
    date: '', grant: null, over: false, stats: { correct: 0, breaches: 0, citations: 0, points: 0 },
  };
}

function startCampaign(day: number) {
  S = newRun('campaign', day);
  startDay();
}

function startEndless() {
  S = newRun('endless', 5);
  startDay();
}

function endlessShift() {
  const r = run();
  const d = new Date(`${ENDLESS_START}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + r.shift - 1);
  r.date = d.toISOString().slice(0, 10);
  r.grant = 'GRANT-' + (0x10 + rnd(0xef)).toString(16).toUpperCase();
}
const endlessQueue = () => Array.from({ length: ENDLESS_SHIFT }, () => generate(ctx()));

function startDay() {
  const r = run();
  r.idx = 0;
  r.honeyLeft = isEndless() || r.day >= 2 ? 1 : 0;
  r.stats = { correct: 0, breaches: 0, citations: 0, points: 0 };
  let title: string;
  let memo: string[];
  let glitch = false;
  if (isEndless()) {
    endlessShift();
    r.queue = endlessQueue();
    title = `Endless shift ${r.shift}`;
    memo = [`Today’s bus grant code is <b>${r.grant}</b>. All rules apply. Packets keep coming until the fuse breaks.`];
  } else {
    const cfg = DAYS[r.day - 1];
    r.queue = buildQueue(cfg, ctx());
    ({ title, memo } = cfg);
    glitch = !!cfg.glitch;
  }
  show('game');
  document.body.classList.toggle('glitchy', glitch);
  el.log.innerHTML = '';
  renderHud();
  rulebook.show({ day: rulesDay(), endless: isEndless(), ctx: ctx() });
  renderPacket();
  const newCodes = isEndless() ? [] : activeCodes(r.day).filter((c) => CODES[c].day === r.day);
  overlay.show(`
      <p class="ov-kicker">${isEndless() ? 'ENDLESS' : `DAY ${r.day} · ${ctx().date}`}</p>
      <h2>${esc(title)}</h2>
      <div class="memo"><p class="memo-from">MEMO from FUSE OPS</p>${memo.map((m) => `<p>${m}</p>`).join('')}</div>
      ${newCodes.length ? `<h3>New reject codes</h3><ul class="newcodes">${newCodes.map((c) => `<li><span class="code">${CODES[c].label}</span> ${CODES[c].desc}</li>`).join('')}</ul>` : ''}
      <button class="btn btn-primary" data-close autofocus>Start shift ▸</button>
    `);
  if (glitch) startGlitchNoise();
}

function endDay() {
  stopGlitchNoise();
  const r = run();
  const st = r.stats;
  const last = r.day === DAYS.length;
  save({ reached: Math.max(load().reached || 1, Math.min(r.day + 1, DAYS.length)) });
  overlay.show(
    `
      <p class="ov-kicker">DAY ${r.day} COMPLETE</p>
      <h2>Shift report</h2>
      <table class="report">
        <tr><td>Packets handled correctly</td><td>${st.correct}</td></tr>
        <tr><td>Citations</td><td>${st.citations}</td></tr>
        <tr><td>Fuse breaches</td><td>${st.breaches}</td></tr>
        <tr><td>Points this shift</td><td>${st.points}</td></tr>
        <tr class="total"><td>Total</td><td>${r.score}</td></tr>
      </table>
      <p class="fuse-line">0xAC: <b>172</b>, locked.</p>
      <button class="btn btn-primary" data-next autofocus>${last ? 'Finish the week ▸' : `Day ${r.day + 1} ▸`}</button>
    `,
    () => {
      if (last) ending();
      else {
        r.day++;
        startDay();
      }
    },
  );
}

function ending() {
  const sv = load();
  const r = run();
  save({ finished: true, best: Math.max(sv.best || 0, r.score) });
  overlay.show(`
      <p class="ov-kicker">WEEK COMPLETE</p>
      <h2>The fuse holds.</h2>
      <pre class="term-out">&gt; read 0xAC
172
&gt; status
LOCKED
&gt; archive inbox
unsigned userland telemetry archived.</pre>
      <p>Final score: <b>${r.score}</b>${r.score > (sv.best || 0) ? ' <span class="tag">NEW BEST</span>' : ''}</p>
      <p>Endless mode is now unlocked: every rule, a fresh grant code each shift, and no end until the fuse breaks.</p>
      <div class="row"><button class="btn btn-primary" data-endless autofocus>Endless mode ▸</button><button class="btn" data-title>Title screen</button></div>
    `);
}

function gameOver() {
  stopGlitchNoise();
  const r = run();
  el.fuse.classList.add('breached');
  el.fuseVal.textContent = '173';
  el.fuseState.textContent = 'BREACHED';
  let extra = '';
  if (isEndless()) {
    const record = r.processed > (load().bestEndless || 0);
    if (record) save({ bestEndless: r.processed });
    extra = `<p>You lasted <b>${r.processed}</b> packets.${record ? ' <span class="tag">NEW RECORD</span>' : ''}</p>`;
  }
  overlay.show(`
      <p class="ov-kicker warn">FUSE BREACHED</p>
      <h2>0xAC reads 173.</h2>
      <p>Three bad packets got through. Somewhere, kumara_hax is taking a screenshot.</p>
      ${extra}
      <p>Score: <b>${r.score}</b></p>
      <div class="row"><button class="btn btn-primary" data-retry autofocus>Try again</button><button class="btn" data-title>Title screen</button></div>
    `);
}

/* ---------- HUD ---------- */

function resetFuse() {
  el.fuse.classList.remove('breached', 'flash');
  el.fuseVal.textContent = '172';
  el.fuseState.textContent = 'LOCKED';
}

function flashFuse() {
  el.fuse.classList.add('flash');
  el.fuseVal.textContent = pick(['173', '17?', '0xAD', '???']);
  el.fuseState.textContent = 'WARNING';
  setTimeout(() => {
    if (run().integrity > 0) resetFuse();
  }, 900);
}

function renderHud() {
  const r = run();
  el.day.textContent = isEndless() ? `SHIFT ${r.shift}` : `DAY ${r.day}/5`;
  el.date.textContent = ctx().date;
  el.score.textContent = String(r.score);
  const combo = comboMult();
  el.combo.textContent = combo > 1 ? `×${combo}` : '';
  el.pips.innerHTML = Array.from({ length: INTEGRITY }, (_, i) => `<span class="pip ${i < r.integrity ? 'on' : ''}"></span>`).join('');
  el.pips.setAttribute('aria-label', `Fuse integrity ${r.integrity} of ${INTEGRITY}`);
  el.honey.hidden = !(isEndless() || r.day >= 2);
  el.honey.disabled = r.honeyLeft < 1;
  el.honeyLeft.textContent = String(r.honeyLeft);
  if (r.integrity === INTEGRITY) resetFuse();
}

function renderPacket() {
  const r = run();
  el.packet.innerHTML = packetHTML(r.queue[r.idx], packetNo(), rulesDay());
  el.packet.classList.remove('arrive');
  void el.packet.offsetWidth; // restart the arrival animation
  el.packet.classList.add('arrive');
  el.queue.textContent = isEndless() ? `processed ${r.processed}` : `${r.queue.length - r.idx} in queue`;
  closeReasons();
  sfx.key();
}

function log(cls: string, html: string) {
  const d = document.createElement('div');
  d.className = 'ln ' + cls;
  d.innerHTML = html;
  el.log.prepend(d);
  while (el.log.children.length > 40) el.log.lastChild!.remove();
}

/* ---------- decisions ---------- */

function openReasons() {
  const codes = activeCodes(rulesDay());
  el.reasons.innerHTML = `<p class="rs-head">Reject — pick a reason <span class="dim">(keys 1–${Math.min(9, codes.length)}${codes.length > 9 ? ', 0, Q–W' : ''})</span></p>
      <div class="rs-grid">${codes.map((c, i) => `<button class="chip code-chip" data-code="${c}"><kbd>${REASON_KEYS[i] ?? ''}</kbd>${CODES[c].label}</button>`).join('')}</div>
      <button class="btn btn-ghost" data-cancel>Cancel (Esc)</button>`;
  el.reasons.hidden = false;
  el.actions.hidden = true;
  el.reasons.querySelector<HTMLElement>('.code-chip')?.focus();
}

function closeReasons() {
  el.reasons.hidden = true;
  el.actions.hidden = false;
}

el.reasons.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  if (b.dataset.code) decide('reject', b.dataset.code as CodeId);
  else if (b.hasAttribute('data-cancel')) closeReasons();
});
$('#btn-accept').addEventListener('click', () => decide('accept'));
$('#btn-reject').addEventListener('click', openReasons);
el.honey.addEventListener('click', () => {
  if (run().honeyLeft > 0) decide('honey');
});

document.addEventListener('keydown', (e) => {
  if (!S || el.game.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (overlay.open) {
    if (e.key === 'Escape') overlay.dismiss();
    return;
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const k = e.key.toLowerCase();
  if (!el.reasons.hidden) {
    if (k === 'escape') return closeReasons();
    const code = activeCodes(rulesDay())[REASON_KEYS.indexOf(k)];
    if (REASON_KEYS.includes(k) && code) {
      e.preventDefault();
      decide('reject', code);
    }
    return;
  }
  if (k === 'a') decide('accept');
  else if (k === 'r') {
    e.preventDefault();
    openReasons();
  } else if (k === 'h' && !el.honey.hidden && S.honeyLeft > 0) decide('honey');
});

/**
 * Scoring: a correct call is 10 × combo; a sprung honeypot 25 × combo; right call, wrong reason +3;
 * rejecting an honest packet −5; a wasted honeypot −15; accepting a hostile packet costs integrity.
 */
function decide(kind: 'accept' | 'reject' | 'honey', code?: CodeId) {
  const r = run();
  if (overlay.open || r.over || r.idx >= r.queue.length) return;
  const p = r.queue[r.idx];
  const broken = evaluate(p, ctx());
  const hostile = broken.length > 0;
  const id = `#${String(packetNo()).padStart(4, '0')}`;
  const why = broken.map((c) => CODES[c].label).join(' + ');
  let pts = 0;

  if (kind === 'honey') {
    r.honeyLeft--;
    if (hostile) {
      r.streak++;
      pts = 25 * comboMult();
      r.stats.correct++;
      sfx.honey();
      log('good', `${id} 🍯 HONEYPOT sprung. ${esc(p.from)} took the bait. <span class="dim">(${why})</span> +${pts}`);
    } else {
      r.streak = 0;
      pts = -15;
      r.stats.citations++;
      sfx.meh();
      log('warn', `${id} 🍯 Honeypot wasted on an honest packet. ${pts}`);
    }
  } else if (kind === 'accept') {
    if (!hostile) {
      r.streak++;
      pts = 10 * comboMult();
      r.stats.correct++;
      sfx.ok();
      log('good', `${id} ACCEPTED. Correct. +${pts}`);
    } else {
      r.streak = 0;
      r.integrity--;
      r.stats.breaches++;
      sfx.bad();
      flashFuse();
      log('bad', `${id} ACCEPTED a hostile packet! It broke: <b>${why}</b>. Integrity −1.`);
    }
  } else {
    const label = CODES[code!].label;
    if (!hostile) {
      r.streak = 0;
      pts = -5;
      r.stats.citations++;
      sfx.meh();
      log('warn', `${id} Rejected an honest packet (${label}). Citation: uptime. ${pts}`);
    } else if (broken.includes(code!)) {
      r.streak++;
      pts = 10 * comboMult();
      r.stats.correct++;
      sfx.ok();
      log('good', `${id} REJECTED: ${label}. Correct. +${pts}`);
    } else {
      pts = 3;
      r.stats.citations++;
      sfx.meh();
      log('warn', `${id} Right call, wrong reason. You said ${label}; it was <b>${why}</b>. +${pts}`);
      r.streak = 0;
    }
  }

  r.score = Math.max(0, r.score + pts);
  r.stats.points += pts;
  if (isEndless()) r.processed++;
  renderHud();
  if (r.integrity <= 0) {
    r.over = true;
    closeReasons();
    setTimeout(gameOver, 500);
    return;
  }
  r.idx++;
  if (isEndless() && r.idx >= r.queue.length) {
    r.idx = 0;
    r.shift++;
    r.queue = endlessQueue();
    log('sys', `— shift ${r.shift} begins —`);
  }
  if (!isEndless() && r.idx >= r.queue.length) {
    setTimeout(endDay, 350);
    return;
  }
  renderPacket();
}

/* ---------- day 4's glitchy terminal ---------- */

let glitchTimer: ReturnType<typeof setInterval> | undefined;
const NOISE = [
  '&gt; searching files…', '&gt; grep: 0 matches', '&gt; timeout waiting on model:cloud (30s)', '&gt; cross-filing residue from QUIZ-ROOM',
  '&gt; retrying…', '&gt; [warn] clock skew 0.172s', '&gt; mounting /dev/fuse… ok',
];
function startGlitchNoise() {
  stopGlitchNoise();
  glitchTimer = setInterval(() => {
    if (overlay.open) return;
    log('noise', pick(NOISE));
    document.body.classList.add('jolt');
    setTimeout(() => document.body.classList.remove('jolt'), 180);
  }, 4200);
}
function stopGlitchNoise() {
  clearInterval(glitchTimer);
  glitchTimer = undefined;
  document.body.classList.remove('glitchy', 'jolt');
}

/* ---------- debug hook for automated playtests: add ?debug to the URL ---------- */

declare global {
  interface Window {
    __fuseAnswer?: () => CodeId[] | null;
  }
}
if (/[?&]debug\b/.test(location.search)) {
  window.__fuseAnswer = () => (S?.queue[S.idx] ? evaluate(S.queue[S.idx], ctx()) : null);
}

/* ---------- boot ---------- */

show('title');
renderTitle();
const BOOT = ['qot fuse controller v1.72', 'probing bus… ok', 'reading 0xAC… 172', 'fuse status: LOCKED', 'awaiting operator_'];
const boot = document.querySelector('#boot');
if (boot) {
  let i = 0;
  const tick = () => {
    if (i < BOOT.length) {
      boot.textContent += (i ? '\n' : '') + '> ' + BOOT[i++];
      setTimeout(tick, 260);
    }
  };
  tick();
}
