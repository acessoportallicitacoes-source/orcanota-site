import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

// Troca <!-- @include caminho --> pelo arquivo de src/, no dev e no build.
// Assim a política e os termos têm uma fonte só: o pop-up da página principal e as páginas /privacidade e /termos.
function includes() {
  return {
    name: 'orcanota-includes',
    transformIndexHtml(html) {
      return html.replace(/<!--\s*@include\s+(\S+)\s*-->/g, (_, file) =>
        readFileSync(resolve(root, 'src', file), 'utf8'),
      );
    },
  };
}

export default defineConfig({
  plugins: [includes()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        privacidade: resolve(root, 'privacidade/index.html'),
        termos: resolve(root, 'termos/index.html'),
      },
    },
  },
});
