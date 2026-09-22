export function headerHTML(): string {
  return `
  <a class="skip-link" href="#mainContent">Lewati ke konten utama</a>
  <header class="header">
    <div class="header-inner">
      <a class="brand" href="#" id="brandHome" aria-label="ICC LSP Portal — kembali ke beranda">
        <span class="brand-mark"><img src="logo_icc.png" alt="Logo ICC" id="brandLogo" /></span>
        <span class="brand-text">
          <h1>ICC <i>LSP</i> Portal</h1>
          <p>Portal Data LSP &amp; Skema Indonesia</p>
        </span>
      </a>
      <div class="nav-actions">
        <button class="pill pill--ghost" type="button" id="btnCariSkema">Cari Skema</button>
      </div>
    </div>
  </header>`;
}

export function bindHeader(onHome: () => void, onCariSkema: () => void): void {
  document.getElementById('brandHome')?.addEventListener('click', (e) => {
    e.preventDefault();
    onHome();
  });
  document.getElementById('btnCariSkema')?.addEventListener('click', onCariSkema);
  const logo = document.getElementById('brandLogo') as HTMLImageElement | null;
  logo?.addEventListener('error', () => {
    const mark = logo.parentElement;
    if (mark) {
      mark.textContent = 'ICC';
      mark.setAttribute('role', 'img');
      mark.setAttribute('aria-label', 'Logo ICC');
    }
  });
}
