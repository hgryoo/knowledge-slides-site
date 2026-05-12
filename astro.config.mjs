import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// SLIDES_REPO points at the knowledge-slides checkout root. Locally
// it's a sibling clone (../knowledge-slides); CI sets it to
// $GITHUB_WORKSPACE/knowledge-slides.
const slidesRepo =
  process.env.SLIDES_REPO
    ? path.resolve(process.env.SLIDES_REPO)
    : path.resolve(here, '../knowledge-slides');

// Deployed at hgryoo.dev/knowledge-slides-site/; CI sets SITE_BASE /
// SITE_URL accordingly. Locally defaults to root on port 9999.
const siteBase = process.env.SITE_BASE || '';
const siteUrl = process.env.SITE_URL || `http://localhost:9999${siteBase}`;

export default defineConfig({
  site: siteUrl,
  base: siteBase || undefined,
  server: { host: '0.0.0.0', port: 9999 },
  vite: {
    server: {
      fs: {
        allow: [here, slidesRepo],
      },
    },
  },
});
