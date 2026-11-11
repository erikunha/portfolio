import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Why this gate exists. The site rounds every line box to whole pixels
// (`round(nearest, 1em * var(--leading), 1px)` in the base layer), because a
// fractional box is what makes two runners lay the same text out differently:
// each rounds the box to its own device pixels, the height changes by one
// pixel, and every glyph below it moves.
//
// The rounding lives in the base layer, so anything that writes `line-height`
// in a later layer bypasses it. Two things do that, and both are easy to
// write by accident:
//
//   - a Tailwind `leading-*` utility, which is `line-height` in the utilities
//     layer. The site has its own `.leading-ratio-*` classes for that, which
//     set the `--leading` token instead and let the base layer round it;
//   - a ratio written directly as `line-height` in a component rule, for the
//     same reason. The site's components set `--leading` and let the base
//     layer do the rounding.
//
// Both are checked here, on the source, so the violation is caught by a unit
// test instead of by a screenshot that moved.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath: string): string =>
  readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const SOURCE_ROOTS = ['components', 'design-system', 'app', 'lib', 'content'];

const cssFiles = (): string[] => {
  const dir = path.join(REPO_ROOT, 'app', 'css');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => path.join(dir, name));
};

const sourceFiles = (): string[] => {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
        continue;
      }
      if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
    }
  };
  for (const root of SOURCE_ROOTS) walk(path.join(REPO_ROOT, root));
  return files;
};

// The stylesheets and the documentation pages. Tailwind's scanner reads
// every file in the project, not only the components: a class name written
// in a comment in a stylesheet or in a paragraph of a documentation page is
// a class name Tailwind generates, and a generated leading utility writes
// `line-height` in the utilities layer, where it bypasses the rounding.
const styleAndDocFiles = (): string[] => {
  const files: string[] = [...cssFiles()];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
        continue;
      }
      if (/\.mdx$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(REPO_ROOT, 'app'));
  return files;
};

// The rules of a stylesheet, with the selectors of each and its body. The
// body of a rule never holds a brace, so the innermost blocks are the ones
// that match, and a rule inside an at-rule comes with its own selector.
const ruleBlocks = (source: string): { selectors: string[]; body: string }[] => {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const blocks: { selectors: string[]; body: string }[] = [];

  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '')
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0 && !selector.startsWith('@'));
    if (selectors.length === 0) continue;
    blocks.push({ selectors, body: match[2] ?? '' });
  }

  return blocks;
};

// Tailwind's own leading utilities. `leading-ratio-*` is the site's own
// class and is deliberately not in this list. The lookbehind keeps the
// custom properties (`--leading-body`, `--leading-page-tight`) out of it:
// those are tokens, not class names, and Tailwind does not generate a
// utility out of a token.
const TAILWIND_LEADING = /(?<![-\w])leading-(?!ratio-)[\w[\].-]+/g;

describe('meta: the line box is rounded, and nothing bypasses it', () => {
  it('uses no Tailwind leading utility, which would set line-height directly', () => {
    const offenders: string[] = [];

    for (const file of [...sourceFiles(), ...styleAndDocFiles()]) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(TAILWIND_LEADING)) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(
          `${path.relative(REPO_ROOT, file)}:${line} uses "${match[0]}" - ` +
            'a Tailwind leading utility writes line-height in the utilities layer, ' +
            "which outranks the base layer that rounds the box. Use the site's " +
            '`.leading-ratio-*` class, which sets the --leading token instead. ' +
            'Tailwind reads every file in the project, so a class name written in a ' +
            'comment or in a paragraph is a class name it generates.',
        );
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('writes no ratio as line-height in a component rule', () => {
    const offenders: string[] = [];

    for (const file of cssFiles()) {
      const relative = path.relative(REPO_ROOT, file);
      const source = readFileSync(file, 'utf-8');
      // The comment in base.css quotes Tailwind's preflight, which mentions
      // `html { line-height: 1.5 }`; the declarations are what matter.
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const match of withoutComments.matchAll(/(?<![-\w])line-height\s*:\s*([^;}]+)/g)) {
        const value = (match[1] ?? '').trim();
        if (!/^[0-9]*\.?[0-9]+$/.test(value)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(
          `${relative}:${line} sets line-height: ${value} - a ratio written as ` +
            'line-height wins over the base layer, so the box it produces stays ' +
            'fractional. Set --leading instead and let the base layer round it.',
        );
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('keeps the rounding itself in place', () => {
    const base = read('app/css/base.css');

    expect(
      base,
      'the base layer rounds the line box with `round(nearest, 1em * var(--leading), 1px)`; ' +
        'without it the site is back to fractional boxes',
    ).toContain('round(nearest, 1em * var(--leading), 1px)');

    expect(
      base,
      'the base layer keeps the ratio for browsers without CSS round(); without the ' +
        'fallback those browsers would compute a line-height of nothing',
    ).toContain('line-height: var(--leading)');
  });

  it('keeps the Tailwind text sizes on rounded boxes too', () => {
    const theme = read('app/css/theme.css');

    for (const size of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '7xl']) {
      expect(
        theme,
        `Tailwind's text-${size} utility writes the line-height of that size, and the ` +
          'utilities layer outranks the base layer, so the size needs its own rounded ' +
          'companion in the theme. Add --text-' +
          `${size}--line-height with the ratio Tailwind pairs with the size, wrapped in round().`,
      ).toContain(`--text-${size}--line-height: round(nearest`);
    }
  });

  it('carries the ratio of every font-size utility the site uses', () => {
    // Tailwind's `text-xs` writes a ratio (1/0.75) into the element's
    // `line-height`, and a descendant inherits that ratio, not the box. The
    // base layer gives every element a box of its own, so the ratio has to
    // travel as `--leading` too. Without this the descendant of a `text-xs`
    // element would take the site's 1.55 instead of the size's 1.333, and the
    // leading would change: a rendering fix dressed as a typography change.
    const theme = read('app/css/theme.css');
    const paired = new Set(
      [...theme.matchAll(/--text-([a-z0-9]+)--line-height:\s*round\(/g)].map(
        (match) => match[1] ?? '',
      ),
    );
    expect(paired.size, 'the theme rounds no font size at all').toBeGreaterThan(0);

    const used = new Set<string>();
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(/(?:^|[\s"'`])((?:[a-z][\w-]*):)?text-([a-z0-9]+)\b/g)) {
        const size = match[2] ?? '';
        // A size the theme does not pair with a line-height (`text-min`,
        // `text-body`) writes no line-height at all, so there is no ratio to
        // carry: the element inherits one, the way it did before.
        if (!paired.has(size)) continue;
        used.add(`${match[1] ?? ''}text-${size}`);
      }
    }
    expect(used.size, 'the site uses no font-size utility at all').toBeGreaterThan(0);

    const utilities = read('app/css/components-utilities.css');
    const offenders: string[] = [];

    for (const usage of [...used].sort()) {
      const selector = `.${usage.replace(/:/g, '\\:')}`;
      const block = ruleBlocks(utilities).find(
        (candidate) =>
          candidate.selectors.includes(selector) ||
          candidate.selectors.some((entry) => entry.startsWith(`${selector},`)),
      );
      if (!block) {
        offenders.push(
          `${usage} is used in the code and has no rule in components-utilities.css - a ` +
            'descendant of that element would inherit the root ratio instead of the ' +
            "size's ratio, and its leading would change.",
        );
        continue;
      }
      if (!/--leading\s*:/.test(block.body)) {
        offenders.push(
          `${usage} has a rule in components-utilities.css without a --leading - the ` +
            "ratio the size carries does not reach the element's descendants, and their " +
            'leading would change.',
        );
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('gives every leading-ratio class the ratio and the element own line-height', () => {
    // The class asks for a leading. The element has to wear it: a Tailwind
    // font-size utility writes `line-height` in the same layer and comes
    // first, so a class that only set `--leading` would leave the element
    // with the size's ratio and the asked-for ratio would reach only the
    // descendants.
    const utilities = read('app/css/components-utilities.css');
    const classes = [
      ...new Set(
        [...utilities.matchAll(/\.(leading-ratio-[\w-]+)/g)].map((match) => match[1] ?? ''),
      ),
    ];
    expect(classes.length, 'no leading-ratio class is defined').toBeGreaterThan(0);

    const blocks = ruleBlocks(utilities);
    const offenders: string[] = [];

    for (const className of classes) {
      const selector = `.${className}`;
      const own = blocks.filter((block) => block.selectors.includes(selector));
      const body = own.map((block) => block.body).join('\n');
      if (!/--leading\s*:/.test(body)) {
        offenders.push(`${selector} sets no --leading - it would not carry a ratio at all.`);
      }
      if (!/line-height\s*:/.test(body)) {
        offenders.push(
          `${selector} sets no line-height - the element itself would keep the ratio of ` +
            'whatever font-size utility is on it, and the asked-for leading would reach ' +
            'only the descendants.',
        );
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
