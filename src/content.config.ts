import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read companion-document markdown files from the sibling
// knowledge-slides repo's `dist/` folder via the glob loader's `base`
// option (Astro 5 content layer feature — collections do NOT have to
// live under src/content/). The file convention is `<slug>.<lang>.md`,
// so the pattern `*.{en,ko}.md` skips the unrelated `dist/README.md`
// without an extra negation.
const here = path.dirname(fileURLToPath(import.meta.url));
const SLIDES_REPO =
  process.env.SLIDES_REPO ?? path.resolve(here, '../../knowledge-slides');

const docs = defineCollection({
  loader: glob({
    pattern: '*.{en,ko}.md',
    base: path.join(SLIDES_REPO, 'dist'),
    // Astro's default id-generator slugifies the path, which strips
    // the dot in `<slug>.<lang>.md` (`…draft.en.md` → `…draften`).
    // Keep the literal basename so getStaticPaths can split slug/lang
    // on the dot deterministically.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
});

export const collections = { docs };
