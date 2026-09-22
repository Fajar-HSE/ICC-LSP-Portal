export function announce(msg: string): void {
  let live = document.getElementById('a11y-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'a11y-live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    document.body.appendChild(live);
  }
  live.textContent = '';
  window.requestAnimationFrame(() => {
    if (live) live.textContent = msg;
  });
}

export function focusMain(): void {
  const main = document.getElementById('mainContent');
  if (!main) return;
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
}

export function trapFocus(container: HTMLElement): () => void {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
