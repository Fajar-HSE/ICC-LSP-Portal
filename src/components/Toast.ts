export function ensureToastWrap(): HTMLElement {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.className = 'toast-wrap';
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function toast(msg: string, kind: 'info' | 'error' = 'info'): void {
  const wrap = ensureToastWrap();
  const el = document.createElement('div');
  el.className = `toast${kind === 'error' ? ' toast--error' : ''}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  wrap.appendChild(el);
  window.setTimeout(() => el.remove(), 4200);
}
