import { byId } from './dom';

let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string) {
  const t = byId('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (t.hidden = true), 3800);
}
