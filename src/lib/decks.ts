import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// SLIDES_REPO is the knowledge-slides checkout root; CI sets it to
// $GITHUB_WORKSPACE/knowledge-slides, locally we use the sibling clone.
const SLIDES_REPO =
  process.env.SLIDES_REPO ?? path.resolve(here, '../../../knowledge-slides');
const DECKS_ROOT = path.join(SLIDES_REPO, 'decks');
const DIST_ROOT = path.join(SLIDES_REPO, 'dist');

/** A deck's section on the landing page. Derived from artifact presence
 *  (slides → talks, companion documents → reading) so the same card can
 *  legitimately appear in both sections; see `deriveCategories`.
 *
 *  Legacy values `notes` / `other` remain in the type for backward-
 *  compat with metadata.json files that set them explicitly. The
 *  landing-page chip surface only renders the canonical two: talks
 *  and reading.
 */
export type DeckKind = 'talks' | 'reading' | 'notes' | 'other';
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

/** Companion-document link surfaced next to the slide outputs on a deck
 *  card. Most commonly an analysis doc on the sibling knowledge-docs-site
 *  ("Doc" link beside the slides PDF), but can also point at a paper,
 *  external blog post, or a same-repo PDF for essay-only entries.
 *
 *  `kind` is informational: rendered as a small label before the link
 *  text. Free-form; current convention is `analysis | essay | paper |
 *  reference | original`. */
export type DeckDocument = {
  label: string;
  url: string;
  kind?: string;
};

export type DeckMetadata = {
  slug: string;
  title: string;
  subtitle?: string;
  date?: string;
  author?: string;
  summary?: string;
  tags?: string[];
  /** Curated semantic categories used for the topic filter row.
   *  Distinct from `tags` (free-form keywords). */
  topics: string[];
  kind?: DeckKind;
  /** Landing-page sections this deck belongs to. Derived from
   *  artifact presence:
   *    - has built slides (any language with html or pdf)  → 'talks'
   *    - has companion documents (documents[] non-empty)   → 'reading'
   *  A deck with both lands in both sections. An explicit `kind` in
   *  metadata.json pins the deck to that single section (used when a
   *  card with slides should still read as a doc, or vice versa). */
  categories: DeckKind[];
  source?: Record<string, unknown>;
  /** Companion-document links rendered next to slide outputs. Empty
   *  array (not omitted) when the deck has slides only. */
  documents: DeckDocument[];
  languages: LangAssets[];
  /** First-available language's thumbnail, used for cards. */
  primaryThumbnail?: string;
  /** First-available language's html, used for the card's main link. */
  primaryUrl?: string;
  /** True if at least one language has a built html. */
  available: boolean;
  /** Author-in-progress. Excluded from the main listing and from
   *  featured selection; surfaced only in the "Drafts" pane. */
  draft: boolean;
  /** Epoch milliseconds when this deck's metadata.json was last
   *  committed (or, in local dev, last modified on disk). Used as a
   *  tie-break when multiple decks share the same `date` so the newer
   *  upload floats to the top of the month group. See `uploadTimestamp`
   *  for source resolution. */
  uploadedAt: number;
};

export type TopicEntry = { topic: string; label: string; count: number };

// Curated topic order + display labels. Topics outside this list still
// work (they fall through to the unknown-topic path in collectTopics)
// but the chip row puts known topics in this canonical order first.
const TOPIC_ORDER: string[] = [
  'cubrid-internals',
  'vector-search',
  'spatial-3d',
  'open-source',
  'paper-review',
];
const TOPIC_LABEL: Record<string, string> = {
  'cubrid-internals': 'CUBRID internals',
  'vector-search': 'Vector search',
  'spatial-3d': 'Spatial / 3D',
  'open-source': 'Open source',
  'paper-review': 'Paper review',
};

function topicLabel(topic: string): string {
  return (
    TOPIC_LABEL[topic] ??
    topic.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export type DeckYearGroup = {
  year: string;
  decks: DeckMetadata[];
};

export type DeckKindGroup = {
  kind: DeckKind;
  label: string;
  decks: DeckMetadata[];
};

// Canonical landing-page sections. A deck can appear in BOTH when it
// carries built slides and companion documents — see deriveCategories.
const KIND_ORDER: DeckKind[] = ['talks', 'reading'];
const KIND_LABEL: Record<DeckKind, string> = {
  talks: 'Talks',
  reading: 'Reading',
  notes: 'Notes',
  other: 'Other',
};

/** When the listing has multiple decks with the same `date` (a common
 *  case for the YYYY-MM-* slug convention where many decks share a
 *  month), tie-break on "most recently uploaded first". The signal is:
 *
 *    1. The commit time of the deck's metadata.json in the slides repo
 *       (via `git log -1 --format=%ct`). This is the canonical "when
 *       did this deck appear in the repo" timestamp and survives CI
 *       checkouts (mtime gets reset on clone).
 *    2. Fallback: filesystem mtime (for an uncommitted metadata.json
 *       in local dev).
 *    3. Final fallback: 0 (older than everything).
 *
 *  NOTE: The deploy workflow needs to fetch full git history for the
 *  knowledge-slides repo (`fetch-depth: 0`) for #1 to work on CI; a
 *  shallow clone would only see the most recent commit and every deck
 *  would get the same timestamp.
 */
function uploadTimestamp(metaPath: string): number {
  try {
    const out = execFileSync(
      'git',
      ['-C', SLIDES_REPO, 'log', '-1', '--format=%ct', '--', metaPath],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const ts = parseInt(out, 10);
    if (Number.isFinite(ts) && ts > 0) return ts * 1000;
  } catch {
    // git not available, file not committed yet, or repo has no
    // history — fall through to mtime.
  }
  try {
    return fs.statSync(metaPath).mtimeMs;
  } catch {
    return 0;
  }
}

function distExists(file: string): boolean {
  try {
    return fs.statSync(path.join(DIST_ROOT, file)).isFile();
  } catch {
    return false;
  }
}

/** A deck's section membership is derived from artifact presence:
 *   - languages with html or pdf  → 'talks'    (presentation-format)
 *   - documents[] non-empty       → 'reading'  (companion document)
 *   - both                        → ['talks', 'reading']
 *  An explicit `kind` in metadata.json pins the deck to that single
 *  section, used when the natural derivation gets it wrong (e.g.
 *  a spec deck with slides should still surface as a reading entry
 *  until the spec.md is attached).
 *  Returns at least one category for any deck that survives the
 *  earlier `languages.length === 0 && documents.length === 0` skip.
 */
function deriveCategories(
  explicitKind: unknown,
  languages: LangAssets[],
  documents: DeckDocument[],
): DeckKind[] {
  if (typeof explicitKind === 'string' && KIND_ORDER.includes(explicitKind as DeckKind)) {
    return [explicitKind as DeckKind];
  }
  const cats: DeckKind[] = [];
  const hasSlides = languages.some((l) => !!l.html || !!l.pdf);
  const hasDocs = documents.length > 0;
  if (hasSlides) cats.push('talks');
  if (hasDocs) cats.push('reading');
  // Legacy fallback for decks with only an unbuilt lang folder.
  if (cats.length === 0) cats.push('talks');
  return cats;
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

    let raw: Partial<DeckMetadata> & {
      hidden?: boolean;
      draft?: boolean;
      topics?: string[];
      documents?: DeckDocument[];
    };
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

    const documents = Array.isArray(raw.documents)
      ? raw.documents.filter(
          (d): d is DeckDocument =>
            typeof d?.label === 'string' && typeof d?.url === 'string',
        )
      : [];

    // Skip a deck only if it has neither built slides nor companion
    // documents. An essay-only entry (no en/ko folder, just a documents
    // array) still earns a card.
    if (languages.length === 0 && documents.length === 0) continue;

    const firstBuilt = languages.find((l) => l.html);
    const primaryThumbnail = languages.find((l) => l.thumbnail)?.thumbnail;
    const primaryUrl = firstBuilt?.html ?? documents[0]?.url;

    const categories = deriveCategories(raw.kind, languages, documents);
    const uploadedAt = uploadTimestamp(metaPath);

    decks.push({
      slug: raw.slug ?? slug,
      title: raw.title ?? slug,
      subtitle: raw.subtitle,
      date: raw.date,
      author: raw.author,
      summary: raw.summary,
      tags: raw.tags ?? [],
      topics: Array.isArray(raw.topics) ? raw.topics : [],
      kind: raw.kind,
      categories,
      source: raw.source as Record<string, unknown> | undefined,
      documents,
      languages,
      primaryThumbnail,
      primaryUrl,
      available: !!firstBuilt || documents.length > 0,
      draft: raw.draft === true,
      uploadedAt,
    });
  }

  // Sort decks primarily by `date` descending, then break ties on
  // upload time (most recent first). The tie-break matters for the
  // common case where several decks share a YYYY-MM and the user
  // expects the newest upload at the top of that month group.
  decks.sort((a, b) => {
    const da = a.date ?? '';
    const db = b.date ?? '';
    if (da !== db) return db.localeCompare(da);
    return b.uploadedAt - a.uploadedAt;
  });
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

// Collect every topic that appears across the given decks, ordered by
// the canonical TOPIC_ORDER first, then alphabetically for any topic
// values not in the predefined list (so future ad-hoc topics still get
// surfaced, just at the end).
export function collectTopics(decks: DeckMetadata[]): TopicEntry[] {
  const counts = new Map<string, number>();
  for (const deck of decks) {
    for (const t of deck.topics) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const ordered: string[] = [];
  for (const t of TOPIC_ORDER) if (counts.has(t)) ordered.push(t);
  const extras = [...counts.keys()]
    .filter((t) => !TOPIC_ORDER.includes(t))
    .sort();
  ordered.push(...extras);
  return ordered.map((topic) => ({
    topic,
    label: topicLabel(topic),
    count: counts.get(topic) ?? 0,
  }));
}

// Fixed kind order (talks → notes → reading → other) keeps the "By kind"
// view stable even when a category temporarily empties out. Empty buckets
// are dropped so the UI doesn't render naked headings.
export function groupByKind(decks: DeckMetadata[]): DeckKindGroup[] {
  const buckets = new Map<DeckKind, DeckMetadata[]>();
  for (const deck of decks) {
    // A deck can belong to multiple categories. Push the same deck
    // reference into every bucket it claims — talks and reading both,
    // when applicable.
    for (const cat of deck.categories) {
      if (!buckets.has(cat)) buckets.set(cat, []);
      buckets.get(cat)!.push(deck);
    }
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
