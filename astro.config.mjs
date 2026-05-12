import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const slidesRepo = path.resolve(here, '../knowledge-slides');

export default defineConfig({
  site: 'http://localhost:9999',
  server: { host: '0.0.0.0', port: 9999 },
  vite: {
    server: {
      fs: {
        allow: [here, slidesRepo],
      },
    },
  },
});
