// three.js is vendored under ./vendor and mapped by the importmap in index.html,
// so neither the dev server nor the static build needs npm runtime dependencies.
// Vite does not follow importmap paths, so vendor/ and models/ are copied into dist/ after the build.
import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';
const copyStatic = () => ({ name: 'copy-vendor-and-models', closeBundle() { for (const d of ['vendor', 'models']) cpSync(d, `dist/${d}`, { recursive: true }); } });
export default defineConfig({ base: './', build: { outDir: 'dist', assetsInlineLimit: 0 }, plugins: [copyStatic()] });
