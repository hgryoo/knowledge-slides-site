# knowledge-slides-site

Astro landing page for decks built by the sibling [`knowledge-slides/`](../knowledge-slides/) repo.

## What it does

- Scans `../knowledge-slides/decks/<slug>/metadata.json` at build/dev time.
- Renders one card per deck on the landing page, linking to the deck's HTML and PDF.
- Exposes the `../knowledge-slides/dist/` folder under `/decks/*` via a `public/decks` symlink.

A deck only appears on the landing page if it has a `metadata.json`. The `cubrid-example*` demo decks intentionally do not have one and are hidden from listings.

To hide a deck that *does* have a `metadata.json` (e.g. an in-progress draft, or a one-off you briefly presented and don't want listed), set `"hidden": true` in its `metadata.json`. The built HTML/PDF stay reachable by direct URL — only the landing listing skips it.

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
