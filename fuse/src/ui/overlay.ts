// The modal used for briefings, shift reports and game over.

export type OverlayAction = 'close' | 'next' | 'endless' | 'retry' | 'title';

export function mountOverlay(root: HTMLElement, body: HTMLElement, onAction: (a: OverlayAction, next: (() => void) | null) => void) {
  let next: (() => void) | null = null;

  const close = () => {
    root.hidden = true;
  };

  body.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const action = (['close', 'next', 'endless', 'retry', 'title'] as const).find((a) => b.hasAttribute(`data-${a}`));
    if (!action) return;
    close();
    onAction(action, next);
  });

  return {
    get open() {
      return !root.hidden;
    },
    /** Opens with trusted HTML. Buttons inside use data-close, data-next, data-endless, data-retry or data-title. */
    show(html: string, then?: () => void) {
      next = then ?? null;
      body.innerHTML = html;
      root.hidden = false;
      const f = body.querySelector<HTMLElement>('[autofocus]');
      if (f) setTimeout(() => f.focus(), 30);
    },
    /** Escape: same as pressing the overlay's close button, if it has one. */
    dismiss() {
      body.querySelector<HTMLButtonElement>('[data-close]')?.click();
    },
    close,
  };
}
