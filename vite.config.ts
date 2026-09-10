import { defineConfig } from 'vite';

import pkg from './package.json';

// DELVE is shipped as ONE self-contained HTML file.
// Vite bundles src/ into a single JS chunk + a single CSS file, and
// build/inline.mjs then inlines both into dist/index.html -> dist/delve.html.
export default defineConfig({
  base: './',
  // バージョン表記の出典は package.json だけにする。
  // ソースに '0.1.0' と書くと、リリースのたびに片方だけ古くなる。
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // 5173 は他プロセスと衝突しがちなので固定でずらす。
  server: { port: 5273, strictPort: true },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000, // inline every asset as a data URI
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'delve.js',
        assetFileNames: 'delve.[ext]',
      },
    },
  },
});
