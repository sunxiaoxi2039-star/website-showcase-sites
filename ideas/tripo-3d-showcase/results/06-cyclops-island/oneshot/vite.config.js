// three.js is vendored under ./vendor and mapped by the importmap in index.html,
// so neither the dev server nor the static build needs npm runtime dependencies.
import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { outDir: 'dist', assetsInlineLimit: 0 } });
