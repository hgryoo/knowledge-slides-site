import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// SLIDES_REPO is the knowledge-slides checkout root; CI sets it to
// $GITHUB_WORKSPACE/knowledge-slides, locally we use the sibling clone.
const SLIDES_REPO =
  process.env.SLIDES_REPO ?? path.resolve(here, '../../../knowledge-slides');
const DECKS_ROOT = path.join(SLIDES_REPO, 'decks');
const DIST_ROOT = path.join(SLIDES_REPO, 'dist');

export type DeckKind = 'talks' | 'notes' | 'reading' | 'other';
export type LangCode = 'en' | 'ko';

const LANGS: LangCode[] = ['en', 'ko'];
const LANG_LABEL: Record<LangCode, string> = { en: 'EN', ko: 'KO' };

export type LangAssets = {
  lang: LangCode;
  label: string;
  html?: string;
  pdf?: string;
  pptx?: string;
  thumbnail?: string;
};

export type DeckMetadata = {
  slug: string;
  title: string;
  subtitle?: string;
  date?: string;
  author?: string;
  summary?: string;
  tags?: string[];
  kind?: DeckKind;
  source?: Record<string, unknown>;
  languages: LangAssets[];
  /** First-available language's thumbnail, used for cards. */
  primaryThumbnail?: string;
  /** First-available language's html, used for the card's main link. */
  primaryUrl?: string;
  /** True if at least one language has a built html. */
  available: boolean;
};

export type DeckYearGroup = {
  year: string;
  decks: DeckMetadata[];
};

export type DeckKindGroup = {
  kind: DeckKind;
  label: string;
  decks: DeckMetadata[];
};

const KIND_ORDER: DeckKind[] = ['talks', 'notes', 'reading', 'other'];
const KIND_LABEL: Record<DeckKind, string> = {
  talks: 'Talks',
  notes: 'Notes',
  reading: 'Reading',
  other: 'Other',
};

function distExists(file: string): boolean {
  try {
    return fs.statSync(path.join(DIST_ROOT, file)).isFile();
  } catch {
    return false;
  }
}

// Deck asset URLs are emitted as RELATIVE paths (no leading slash) so
// they resolve correctly whether the site is mounted at root (dev) or
// under /knowledge-slides-site/ (prod). The browser resolves them
// against the page URL, which always ends with a trailing slash on
// Starlight-style Astro routes.
function detectLang(slug: string, lang: LangCode): LangAssets | null {
  // A language is "present" if the `<lang>/` sub-folder exists. Historically
  // we checked for `<lang>/slides.md` (the Marp source) but pdf/pptx-source
  // decks have no slides.md — only an outline.md and the authoritative file
  // under `assets/orig/`. The lang dir is the common marker across all
  // source_format values.
  const langDir = path.join(DECKS_ROOT, slug, lang);
  if (!fs.existsSync(langDir)) return null;

  const html = `${slug}.${lang}.html`;
  const pdf = `${slug}.${lang}.pdf`;
  const thumb = `${slug}.${lang}.thumb.png`;

  return {
    lang,
    label: LANG_LABEL[lang],
    html: distExists(html) ? `decks/${html}` : undefined,
    pdf: distExists(pdf) ? `decks/${pdf}` : undefined,
    thumbnail: distExists(thumb) ? `decks/${thumb}` : undefined,
  };
}

export function loadDecks(): DeckMetadata[] {
  if (!fs.existsSync(DECKS_ROOT)) return [];

  const slugs = fs
    .readdirSync(DECKS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const decks: DeckMetadata[] = [];

  for (const slug of slugs) {
    const metaPath = path.join(DECKS_ROOT, slug, 'metadata.json');
    if (!fs.existsSync(metaPath)) continue;

    let raw: Partial<DeckMetadata> & { hidden?: boolean };
    try {
      raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch (err) {
      console.warn(`[decks] failed to parse ${metaPath}:`, err);
      continue;
    }

    // `hidden: true` opts a deck out of the landing listing entirely (the
    // built HTML/PDF stay accessible by direct URL).
    if (raw.hidden === true) continue;

    const languages = LANGS.map((l) => detectLang(slug, l)).filter(
      (x): x is LangAssets => x !== null,
    );

    if (languages.length === 0) continue; // no source slides at all

    const firstBuilt = languages.find((l) => l.html);
    const primaryThumbnail = languages.find((l) => l.thumbnail)?.thumbnail;
    const primaryUrl = firstBuilt?.html;

    decks.push({
      slug: raw.slug ?? slug,
      title: raw.title ?? slug,
      subtitle: raw.subtitle,
      date: raw.date,
      author: raw.author,
      summary: raw.summary,
      tags: raw.tags ?? [],
      kind: raw.kind ?? 'talks',
      source: raw.source as Record<string, unknown> | undefined,
      languages,
      primaryThumbnail,
      primaryUrl,
      available: !!firstBuilt,
    });
  }

  decks.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return decks;
}

export function groupByYear(decks: DeckMetadata[]): DeckYearGroup[] {
  const buckets = new Map<string, DeckMetadata[]>();
  for (const deck of decks) {
    const year = deck.date?.slice(0, 4) ?? 'undated';
    if (!buckets.has(year)) buckets.set(year, []);
    buckets.get(year)!.push(deck);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, decks]) => ({ year, decks }));
}

// Fixed kind order (talks → notes → reading → other) keeps the "By kind"
// view stable even when a category temporarily empties out. Empty buckets
// are dropped so the UI doesn't render naked headings.
export function groupByKind(decks: DeckMetadata[]): DeckKindGroup[] {
  const buckets = new Map<DeckKind, DeckMetadata[]>();
  for (const deck of decks) {
    const kind: DeckKind = deck.kind ?? 'talks';
    if (!buckets.has(kind)) buckets.set(kind, []);
    buckets.get(kind)!.push(deck);
  }
  return KIND_ORDER.filter((k) => buckets.has(k)).map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    decks: buckets.get(kind)!,
  }));
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function monthLabel(date: string | undefined): string {
  if (!date) return '';
  const m = Number(date.slice(5, 7));
  if (!m || m < 1 || m > 12) return '';
  return MONTH_LABELS[m - 1];
}
