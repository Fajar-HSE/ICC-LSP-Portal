export function headerHTML(): string {
  return `
  <a class="skip-link" href="#mainContent">Lewati ke konten utama</a>
  <header class="header">
    <div class="header-inner">
      <a class="brand" href="#" id="brandHome" aria-label="ICC LSP Portal — kembali ke beranda">
        <span class="brand-mark"><img src="https://training-jogja.com/wp-content/uploads/2026/09/indonesian-certification-center-266x300-1.png" alt="Logo Indonesian Certification Center" id="brandLogo" /></span>
        <span class="brand-text">
          <h1>ICC <i>LSP</i> Portal</h1>
          <p>Portal Data LSP &amp; Skema Indonesia</p>
        </span>
      </a>
    </div>
  </header>`;
}

export function bindHeader(onHome: () => void): void {
  document.getElementById('brandHome')?.addEventListener('click', (e) => {
    e.preventDefault();
    onHome();
  });
  const logo = document.getElementById('brandLogo') as HTMLImageElement | null;
  logo?.addEventListener('error', () => {
    const mark = logo.parentElement;
    if (mark) {
      mark.textContent = 'ICC';
      mark.classList.add('brand-mark--fallback');
      mark.setAttribute('role', 'img');
      mark.setAttribute('aria-label', 'Logo ICC');
    }
  });
}
