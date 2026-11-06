// Little synthesised beeps. Nothing is downloaded.

import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = !!load().muted;

function beep(freq = 440, dur = 0.06, type: OscillatorType = 'square', vol = 0.04) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
  } catch {
    // no audio available
  }
}

export const sfx = {
  ok: () => {
    beep(660, 0.05);
    setTimeout(() => beep(990, 0.07), 60);
  },
  bad: () => beep(140, 0.25, 'sawtooth', 0.05),
  meh: () => beep(330, 0.08, 'triangle'),
  key: () => beep(1200, 0.015, 'square', 0.015),
  honey: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.06), i * 55)),
};

/** Wires up the footer's sound toggle. */
export function mountMuteButton(btn: HTMLButtonElement) {
  const set = (m: boolean) => {
    muted = m;
    save({ muted: m });
    btn.textContent = m ? 'Sound: off' : 'Sound: on';
    btn.setAttribute('aria-pressed', String(m));
  };
  btn.addEventListener('click', () => set(!muted));
  set(muted);
}
