import { defineConfig } from 'vite';

// Vite build untuk GitHub Pages (base relatif) + dev server lokal.
// Env: VITE_SB_URL / VITE_SB_KEY (lihat .env.example). Fallback ke nilai
// publik lama agar deploy statis lama tetap jalan tanpa secrets.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    open: false,
  },
});
