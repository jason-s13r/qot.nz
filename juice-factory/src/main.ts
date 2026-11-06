import './styles/theme.css';
import './styles/game.css';

import { catchUp, step } from './game/economy';
import { cash, vol } from './game/format';
import { load, save } from './game/save';
import { fresh, noBoosts, type Game } from './game/state';
import { mountBoard } from './ui/board';
import { byId } from './ui/dom';
import { mountHud } from './ui/hud';
import { mountPress } from './ui/press';
import { toast } from './ui/toast';

const RENDER_EVERY = 0.1; // seconds
const AUTOSAVE_EVERY = 5;
const NEWS_EVERY = 9;

const loaded = load();
const game: Game = { s: loaded?.state ?? fresh(), boosts: noBoosts() };

if (loaded?.migrated) {
  save(game.s);
  setTimeout(() => toast('The factory has shops now! Sell your juice to earn money, then spend it on upgrades.'), 400);
} else if (loaded) {
  const away = catchUp(game);
  if (away && (away.made > 0 || away.earned > 0)) {
    setTimeout(() => toast(`While you were away: ${vol(away.made)} squeezed, ${cash(away.earned)} earned.`), 400);
  }
}

const hud = mountHud(game);
const press = mountPress(game, (full) => render(full));
const board = mountBoard(game, () => render(true));

function render(full = false) {
  const now = Date.now();
  hud.render(now);
  press.render(now);
  board();
  if (full) hud.renderStats(now);
}

/* save and reset */
function saveNow(quiet: boolean) {
  const ok = save(game.s);
  if (!quiet) toast(ok ? 'Saved.' : 'This browser blocked saving. Progress lasts until you close the tab.');
}
byId('saveBtn').addEventListener('click', () => saveNow(false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow(true);
});
addEventListener('pagehide', () => saveNow(true));

// Reset needs two clicks within four seconds.
const resetBtn = byId<HTMLButtonElement>('resetBtn');
let armed: ReturnType<typeof setTimeout> | null = null;
function disarm() {
  if (armed) clearTimeout(armed);
  armed = null;
  resetBtn.classList.remove('armed');
  resetBtn.textContent = 'Reset factory';
}
resetBtn.addEventListener('click', () => {
  if (!armed) {
    resetBtn.classList.add('armed');
    resetBtn.textContent = 'Click again to wipe everything';
    armed = setTimeout(disarm, 4000);
    return;
  }
  disarm();
  game.s = fresh();
  game.boosts = noBoosts();
  saveNow(true);
  toast('Factory reset. Back to one orange.');
  render(true);
});

/* main loop */
let prev = 0;
let sinceRender = 0;
let sinceSave = 0;
let sinceNews = 0;
function tick(t: number) {
  const dt = Math.min(1, (t - prev) / 1000);
  prev = t;
  const now = Date.now();
  step(game, dt, now);
  sinceRender += dt;
  sinceSave += dt;
  sinceNews += dt;
  if (sinceRender > RENDER_EVERY) {
    sinceRender = 0;
    render();
  }
  if (sinceSave > AUTOSAVE_EVERY) {
    sinceSave = 0;
    render(true);
    saveNow(true);
  }
  if (sinceNews > NEWS_EVERY) {
    sinceNews = 0;
    hud.rotateNews();
  }
  press.tick(now);
  requestAnimationFrame(tick);
}

render(true);
hud.rotateNews();
requestAnimationFrame((t) => {
  prev = t;
  requestAnimationFrame(tick);
});
