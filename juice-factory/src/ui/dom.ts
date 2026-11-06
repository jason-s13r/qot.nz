// DOM helpers. The render loop runs ten times a second, so these only touch the page when a
// value actually changes; that stops the browser reflowing and nudging the scroll position.

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from the page`);
  return el as T;
}

export function setText(el: Element, v: unknown) {
  const s = String(v);
  if (el.textContent !== s) el.textContent = s;
}

export function setHidden(el: HTMLElement, v: boolean) {
  if (el.hidden !== v) el.hidden = v;
}

export function setDisabled(el: HTMLButtonElement, v: boolean) {
  if (el.disabled !== v) el.disabled = v;
}

export function setAttr(el: Element, k: string, v: string) {
  if (el.getAttribute(k) !== v) el.setAttribute(k, v);
}

/** Creates an element from a trusted HTML string (game content only, never player input). */
export function fromHTML<T extends HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function q<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`${sel} not found`);
  return el;
}
