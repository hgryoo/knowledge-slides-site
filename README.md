# knowledge-slides-site

Astro landing page for decks built by the sibling [`knowledge-slides/`](../knowledge-slides/) repo.

## What it does

- Scans `../knowledge-slides/decks/<slug>/metadata.json` at build/dev time.
- Renders one card per deck on the landing page, linking to the deck's HTML and PDF.
- Exposes the `../knowledge-slides/dist/` folder under `/decks/*` via a `public/decks` symlink.

A deck only appears on the landing page if it has a `metadata.json`. The `cubrid-example*` demo decks intentionally do not have one and are hidden from listings.

Two metadata flags control listing visibility:

- `"hidden": true` — hidden from the **deployed** landing only (i.e. `hgryoo.dev/knowledge-slides-site`). The card still appears on the local dev landing with a small `local` chip so the author can see private decks while previewing. Built HTML/PDF are uploaded to the public site as usual, so anyone with the direct URL can open the deck — the privacy guarantee is "not listed on the landing", not "not deployed".
- `"draft": true` — surfaced only when the **Drafts** chip is toggled on; excluded from Featured selection. Visible on both local and deployed builds.

The public/local split is driven by the `PUBLIC_BUILD=1` env var, which is set in `.github/workflows/deploy.yml` and unset locally. To preview the public-build behavior locally:

```bash
PUBLIC_BUILD=1 npm run dev    # or `npm run build && npm run preview`
```

## Run locally

```bash
./install.sh           # one-time: npm install + link public/decks
npm run dev            # http://localhost:9999
```

To rebuild slides for a deck, go to `../knowledge-slides/` and re-run `marp`. The site reads the result on next request — no rebuild needed in dev mode.

## Static build

```bash
npm run build          # output: dist/
npm run preview        # serve dist/ locally
```

Note: `astro build` copies `public/decks` (via symlink) into `dist/`. Re-run `./install.sh` if you cloned freshly.

## Adding a new deck

1. Author the deck in `../knowledge-slides/decks/<your-slug>/` (Marp `slides.md` + assets).
2. Build it: `marp ... -o ../knowledge-slides/dist/<your-slug>.html`.
3. Add `../knowledge-slides/decks/<your-slug>/metadata.json` with at minimum:
   ```json
   {
     "slug": "your-slug",
     "title": "Talk title",
     "subtitle": "optional",
     "date": "YYYY-MM-DD",
     "summary": "one-paragraph blurb",
     "outputs": { "html": "your-slug.html", "pdf": "your-slug.pdf" }
   }
   ```
4. The card appears automatically. No code changes needed.
