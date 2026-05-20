/**
 * Inlines all of app/css/*.css into a single string for SSR-time rendering.
 *
 * The order matches app/globals.css's @import sequence exactly:
 *   tokens -> base -> crt -> layout -> sections -> chrome -> shell -> contact -> footer -> responsive
 *
 * Read at module load (once per Node process), not per request. Result is
 * cached in module scope.
 *
 * Why this exists (vs `import './globals.css'`): the import statement triggers
 * Next 15's CSS pipeline to populate `entryCSSFiles` in the build manifest,
 * which causes React 19 Float to emit a render-blocking <link rel="stylesheet">
 * in the SSR output. By inlining the CSS as a <style> tag instead, we eliminate
 * the render-blocking link on the dynamic `/` route. See DECISIONS.md
 * 2026-05-19 "PR-1 CSS defer (inline-everything)" for the full rationale.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CSS_DIR = path.join(process.cwd(), 'app', 'css');

// Order MUST match app/globals.css's @import sequence. If you reorder
// app/globals.css, mirror the change here. Drift-protected by
// __tests__/inline-css.test.ts.
const CSS_FILES = [
  '_tokens.css',
  '_base.css',
  '_crt.css',
  '_layout.css',
  '_sections.css',
  '_chrome.css',
  '_shell.css',
  '_contact.css',
  '_footer.css',
  '_responsive.css',
] as const;

/**
 * Lightweight CSS minifier sufficient for Lighthouse's `unminified-css` audit.
 * Strips comments, collapses whitespace, removes unnecessary punctuation
 * spacing. Does not handle every CSS edge case (e.g., URLs containing `;` in
 * data: URIs), but our partials don't use those constructs.
 *
 * `+` and `-` are deliberately NOT in the punctuation-strip class because
 * they're arithmetic operators inside `calc()` / `min()` / `max()` /
 * `clamp()` that REQUIRE surrounding whitespace per spec:
 *   `calc(80px + env(safe-area-inset-bottom, 0px))` is valid
 *   `calc(80px+env(safe-area-inset-bottom, 0px))` is invalid (parses as a
 *   unitless `+env(...)` literal). The codebase uses calc(... + ...) in
 *   _chrome.css and _layout.css. We trade the ~5-byte saving from
 *   stripping `+` in CSS combinators (`.a + .b` → `.a+.b`) for not
 *   silently breaking every calc() expression. Drift-protected by
 *   __tests__/inline-css.test.ts.
 */
function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip /* comments */
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\s*([{}:;,>~])\s*/g, '$1') // remove spaces around CSS punctuation (excl. + and -)
    .replace(/;}/g, '}') // remove last semicolon before close brace
    .trim();
}

export const INLINE_CSS: string = minifyCss(
  CSS_FILES.map((f) => readFileSync(path.join(CSS_DIR, f), 'utf-8')).join('\n'),
);
