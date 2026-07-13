# SEO & Accessibility Improvements — Design Spec

**Date:** 2026-07-13
**Scope:** One PR. Correctness + accessibility hygiene surfaced by an external SEO audit, verified against the codebase.
**Framing (honest):** The value here is *correctness* (stopping 5 real pages from self-reporting as homepage duplicates) and *accessibility*, with SEO benefit. It is not a ranking lever — a personal-brand site's traffic is direct/LinkedIn/referral, not organic search. Bundled as one PR at the owner's request; pr-size will read red by design (reviewed as one cohesive pass).

> **Superseded where noted — DECISIONS.md (2026-07-13) + the shipped code govern.** This is the *pre-implementation* spec; review reversed the og:image call. The shipped `dsPageMetadata` re-specifies the FULL `openGraph` + `twitter` per route — `og:image` is KEPT (the branded `/og.png`), not dropped — because Next's shallow metadata merge would otherwise silently drop siteName/locale/image and leave the subpages inheriting the homepage's twitter card. Where this spec says otherwise, the code + DECISIONS.md are authoritative.

---

## Goal

Fix three classes of issue, each independently verified against the live code:

1. **Metadata correctness** — every `/design-system/*` route currently inherits the root's absolute `alternates.canonical = https://erikunha.dev` and `openGraph.url = https://erikunha.dev`, so all five subpages self-report the homepage as their canonical. Also: homepage meta description is 212 chars (truncates before the tech-stack keywords), and `sitemap.ts` emits one build-date `lastmod` for all URLs.
2. **Semantic headings** — two `<h1>` elements (both "Erik Cunha", desktop+mobile hero variants), and the ~20 section `<h2>` headings are raw shell commands ("LS -LA ./PROJECTS") that carry no descriptive keyword/topic signal for crawlers or screen readers (each section's `aria-labelledby` accessible name is the raw command).
3. **Discoverability** — `/design-system` (5 pages of real content, in the sitemap) has no footer/in-content link from the homepage; it is only linked from the desktop topbar (`hidden xl:inline`), so mobile/tablet crawlers and users can't reach it. No `BreadcrumbList` schema or breadcrumb UI on the hierarchy.

## Non-goals (explicitly rejected — conflict with locked constraints)

- Images for Image Search (perf budget), hreflang / i18n (out of scope), blog/article engine (out of scope), PWA manifest (audit rates lowest).
- www→apex 301: a Vercel dashboard toggle, not code. The canonical fix mitigates it. Flag to owner; not in this PR.
- De-terminalizing the visible headings: the terminal voice is the brand. We add *hidden* descriptive text, we do not change visible copy.

---

## File structure & changes

### Unit 1 — Metadata correctness

**New:** `app/design-system/_lib/page-metadata.ts`
- Exports `dsPageMetadata({ slug, title, description }): Metadata`.
- Returns `{ title, description, alternates: { canonical: <path> }, openGraph: { title, description, url: <path>, type: 'website' } }` where `<path>` = `/design-system` for `slug: ''` else `/design-system/${slug}`.
- Relative paths resolve against the root `metadataBase` (`https://erikunha.dev`) — no absolute URLs duplicated.
- Rationale for a helper: Next.js merges metadata shallowly, and setting `openGraph` in a child *replaces* the parent's `openGraph` entirely (title/description/image lost). The helper re-specifies the og fields each subpage needs, keeping canonical + og:url per-route without silently dropping og metadata. (Superseded — see the banner above: the shipped helper re-specifies the FULL `openGraph` + a per-route `twitter` card, including the branded `/og.png`, because the shallow replace would otherwise silently drop siteName/locale/image and the twitter card. The earlier "text docs, drop og:image" call was reversed in review; see DECISIONS.md.)

**Modify:** the 5 MDX metadata exports to use the helper:
- `app/design-system/page.mdx` → `export const metadata = dsPageMetadata({ slug: '', title: '…', description: '…' })`
- `app/design-system/tokens/page.mdx` → `slug: 'tokens'`
- `app/design-system/components/page.mdx` → `slug: 'components'`
- `app/design-system/enforcement/page.mdx` → `slug: 'enforcement'`
- `app/design-system/changelog/page.mdx` → `slug: 'changelog'`
- Preserve each existing `title`/`description` string verbatim.

**Modify:** `app/layout.tsx:29` — homepage meta description 212 → ~150 chars.
- MUST retain the substring `Senior Full-Stack Engineer` (the `identity-consistency` gate asserts it; `__tests__/identity-consistency.test.ts`).
- Front-load the highest-value terms; drop the trailing duplicated stack list that gets truncated.
- Draft (150 chars, to be finalized in review): `Senior Full-Stack Engineer — React, Next.js, Angular, TypeScript, Node.js. Frontend architecture, platform & applied-AI engineering for high-traffic apps.`
- Do NOT touch `metadata.title` (68 chars) — the identity + og-metadata tests pin its exact value, and trimming to 60 risks the identity substring. Out of scope; documented as accepted.

**Modify:** `app/sitemap.ts` — per-URL `lastmod`. Since there is no per-page content-modified source, use `git log -1 --format=%cI <file>`-derived dates at build, OR (simpler, no git dependency) keep the homepage at build date and set design-system pages to a stable authored date constant per page. Decide in the plan; the minor accuracy nit does not justify a git-shell dependency in the sitemap builder if a maintained constant map is cleaner.

### Unit 2 — Semantic headings

**Modify:** `components/sections/Hero/Hero.tsx` — collapse to a single semantic `<h1>` via the sr-only pattern:
- Add ONE `<h1 className="sr-only">Erik Cunha</h1>` as the first child of the Hero fragment (viewport-independent, always in the DOM, crawled + announced once).
- Change the desktop `<h1 …data-testid="hero-name">` (line 19-24) and the mobile `<h1 …data-testid="hero-name">` (line 74-79) to `<p … aria-hidden="true">` with their existing classNames unchanged (pixel-identical; `aria-hidden` prevents the visible duplicates from being re-announced).
- Net: exactly one `<h1>` in the DOM; each viewport still visually shows "Erik Cunha"; screen readers get one h1 at every viewport (fixes the prior per-viewport ambiguity).
- **Visual-baseline impact: expected NONE** (`<p>` with identical explicit classes renders identically to `<h1>`; the sr-only h1 is `position:absolute;clip`). MANDATORY: inspect the hero visual before/after via Playwright MCP (desktop 1280×720 + mobile 375×812); only if a real pixel diff appears, regenerate `tests/visual/visual.spec.ts` hero baseline (darwin+linux) per `.claude/skills/visual-baseline-regen`.

**Modify:** `components/sections/Hero/Hero.test.tsx` — update the heading assertions to the new truth:
- `h1Count` → 1 (line 57-61).
- The `.hero-desktop .hero-bio h1` / `.hero-mobile h1` assertions (lines 25-41) → assert the visible name is now a `p[aria-hidden]` with `data-testid="hero-name"` in each variant, AND assert exactly one `h1` with text "Erik Cunha" exists (sr-only).

**Modify:** `components/responsive/Module/Module.tsx` — add an optional `srLabel?: string` prop:
- Type addition (lines 4-12): `srLabel?: string`.
- Render `{srLabel ? <span className="sr-only">{srLabel}</span> : null}` as the FIRST child inside the `<h2>` (before the icon span, line 49), so the accessible name reads "Projects, ls -la ./projects" and crawlers get the plain-English topic first. (sr-only is clip-based, NOT display:none, so it IS crawled.)
- The visible command spans stay exactly as-is. No visual change → no baseline impact.

**New:** `content/section-labels.ts` — plain-English `srLabel` per section, Zod-validated (content discipline: header strings currently live as inline literals in each section .tsx, which already violates the content rule; this PR does NOT migrate the visible headers — out of scope — but the NEW srLabel values go in content/ per the rule).
- Shape: `export const SECTION_LABELS = { 'sec-contact': 'Contact', 'sec-projects': 'Projects', … } as const;` keyed by section id, with a Zod guard (non-empty strings). Map all 20 sections (readme→"About / README", projects→"Projects", credentials→"Credentials", responsibilities→"Responsibilities", career/gitlog→"Career history", now→"Now", contact→"Contact", design-system-adjacent ones, etc. — exact labels finalized in the plan).
- Each section passes `srLabel={SECTION_LABELS['<id>']}` to its `<Module>`.
- A build-time/test guard asserts every rendered `Module` id has a label (no silent gap).

### Unit 3 — Discoverability

**Modify:** `components/sections/Footer/Footer.client.tsx` — add a `/design-system` internal link.
- Add it to the NETSTAT panel (both the mobile-grid variant ~lines 231-270 and the desktop `<pre>` variant ~lines 271-311, since content is duplicated) as a `netstat-link`-styled internal `<a href="/design-system">` (NOT `target="_blank"` — it is same-site). Label e.g. `~/design_system`.
- This is the first internal link in the footer; it adds the mobile/tablet coverage the `hidden xl:inline` topbar link lacks.
- **Visual-baseline impact: YES** — the footer is a captured section (`tests/visual/visual.spec.ts` includes footer? confirm; if the footer is in a baselined section, regen darwin+linux). Inspect + regen per the skill.

**Modify:** one contextual in-content link — `components/sections/CredentialsSection` or `ResponsibilitiesSection` (whichever already references design-system rigor / the token pipeline in its copy) gets one inline `<a href="/design-system">` on a relevant phrase. Body-content internal links pass more equity than a footer link. Exact anchor chosen in the plan after reading the section copy.

**New:** `breadcrumbSchema` in `content/seo.ts` — a `BreadcrumbList` JSON-LD builder.
- Export `export function breadcrumbSchema(trail: {name: string, path: string}[]) {…}` returning a `@type: BreadcrumbList` object with `itemListElement` (position, name, item=absolute URL from `https://erikunha.dev` + path). Zod-guard the shape like `personSchema`.
- The design-system pages inject it; the homepage does not (single-level).

**New:** breadcrumb UI + schema injection on `app/design-system/layout.tsx` (currently exports no metadata and is a plain wrapper):
- A small server component `app/design-system/_components/Breadcrumb.tsx` rendering a `<nav aria-label="Breadcrumb"><ol>…</ol></nav>` trail (Home → Design System → <page>), styled to the terminal aesthetic (e.g. `~ / design-system / tokens`).
- The layout injects `<script type="application/ld+json">{JSON.stringify(breadcrumbSchema(trail))}</script>`. Trail derived from the route segment (layout can read the child segment via `params`/segment, or each page passes its crumb — decide in plan; simplest is a per-page crumb prop or a segment map).

---

## Testing (TDD, per unit)

- **Unit 1:** behavioral test that `dsPageMetadata({slug:'tokens',…}).alternates.canonical === '/design-system/tokens'` and `.openGraph.url === '/design-system/tokens'`; a test that the homepage `metadata.description.length <= 160` AND contains `Senior Full-Stack Engineer` (extends `identity-consistency`); sitemap test that each URL has a distinct/expected `lastmod`.
- **Unit 2:** Hero test updated (one h1, two aria-hidden p); a Module test that `srLabel` renders an `.sr-only` span inside the `<h2>` and that the section's accessible name includes the label; a content-guard test that every section id in the rendered tree has a `SECTION_LABELS` entry.
- **Unit 3:** footer test asserting an internal `a[href="/design-system"]` with no `target="_blank"`; a `breadcrumbSchema` unit test (positions 1..n, absolute item URLs, Zod valid); a design-system layout test that the breadcrumb `<nav aria-label="Breadcrumb">` and the JSON-LD script render.
- **Gates:** axe-core (a11y) must stay 100; Lighthouse SEO stays 100; `identity-consistency` + `og-metadata` tests must pass (the description change touches the former). Visual baselines: hero (expected no-op, verify) + footer (expected change, regen).

## Failure modes to convert into explicit plan tasks (thinking-inversion — run before writing-plans)

1. Next.js `openGraph`/`twitter` child-replace silently drops any field not restated (siteName/locale/image, the whole twitter card) → helper re-specifies the FULL og + twitter per route incl the branded `/og.png` (the earlier "accept image loss" option was reversed in review; see DECISIONS.md).
2. sr-only `srLabel` inside `<h2>` changes the section accessible name → verify it reads sensibly ("Projects, ls -la ./projects"), not garbled; confirm axe stays 100.
3. Hero `<h1>`→`<p>` visual drift (even 1px reflows the baseline) → inspect-before-commit; the sr-only h1 must not introduce layout (position:absolute).
4. Footer internal link with `target="_blank"` would be wrong (same-site) → assert no `_blank`.
5. Description trim drops `Senior Full-Stack Engineer` → identity gate reds; keep the substring, test length AND substring.
6. `SECTION_LABELS` missing a section id → the content-guard test must fail closed (enumerate rendered ids).
7. Breadcrumb JSON-LD absolute URLs must match canonical host exactly (`https://erikunha.dev/...`) or it self-contradicts the canonical.
8. Two JSON-LD scripts in `<head>` (person + breadcrumb) — confirm both valid, no duplicate `@context` issues; breadcrumb only on design-system routes, not the homepage.

## Reversibility

Every unit is independently revertible. No data migration, no dependency added (all changes are metadata/markup/content). The riskiest touch is the Hero h1 (visual parity); it is guarded by inspect-before-commit + the visual baseline.
