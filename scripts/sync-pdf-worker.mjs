// Keep the viewer and its worker on exactly the same installed pdfjs-dist version.
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
copyFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), new URL('../public/pdf.worker.min.mjs', import.meta.url));
