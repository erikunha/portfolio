import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const SOURCE_HINT = /readFileSync|readFile\(/;
const TARGETS_APP_SOURCE = /['"`](?:[^'"`]*\/)?(app|components|lib|scripts)(\/|['"`])/;
const ALLOW_TAG = /behavioral-test-allow:/;

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'coverage',
  'dist',
  '.claude',
  '.git',
  '.worktrees',
  '.stryker-tmp',
  'playwright-report',
  'test-results',
]);
const SKIP_ROOTS = new Set(['out', 'build']);
const TEST_DIRS = new Set(['__tests__', 'tests']);
const TEST_FILE = /\.(test|spec|e2e)\.[cm]?[jt]sx?$/;
const ANY_SCRIPT = /\.[cm]?[jt]sx?$/;
const TYPE_DECL = /\.d\.ts$/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;
const IMPORT_LINE = /^\s*import\b/;
const CALL_LOOKAHEAD_LINES = 3;

const STRING_LITERAL = /(['"`])(?:\\.|(?!\1).)*?\1/g;
const LINE_COMMENT = /\/\/.*$/;

function parenBalance(line: string): number {
  const code = line.replace(STRING_LITERAL, '').replace(LINE_COMMENT, '');
  return (code.match(/\(/g) ?? []).length - (code.match(/\)/g) ?? []).length;
}

function callText(lines: string[], index: number): string {
  let text = lines[index] ?? '';
  let depth = parenBalance(text);
  for (let i = index + 1; depth > 0 && i <= index + CALL_LOOKAHEAD_LINES; i++) {
    const next = lines[i] ?? '';
    text += ` ${next}`;
    depth += parenBalance(next);
  }
  return text;
}

function isAllowTagged(lines: string[], index: number): boolean {
  if (ALLOW_TAG.test(lines[index] ?? '')) return true;
  for (let i = index - 1; i >= 0 && COMMENT_LINE.test(lines[i] ?? ''); i--) {
    if (ALLOW_TAG.test(lines[i] ?? '')) return true;
  }
  return false;
}

const isTestCode = (full: string, entry: string) => {
  if (TYPE_DECL.test(entry)) return false;
  const insideTestDir = full.split(sep).some((segment) => TEST_DIRS.has(segment));
  return insideTestDir ? ANY_SCRIPT.test(entry) : TEST_FILE.test(entry);
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    if (SKIP_DIRS.has(e)) return [];
    if (dir === ROOT_DIR && SKIP_ROOTS.has(e)) return [];
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return isTestCode(full, e) ? [full] : [];
  });
}

const READER_BODY = 300;
const ARROW_READER = new RegExp(
  `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>[\\s\\S]{0,${READER_BODY}}?(?:readFileSync|readFile\\()`,
  'g',
);
const FUNCTION_READER = new RegExp(
  `function\\s+([A-Za-z_$][\\w$]*)\\s*\\([^)]*\\)[\\s\\S]{0,${READER_BODY}}?(?:readFileSync|readFile\\()`,
  'g',
);

const escapeForRegExp = (name: string) => name.replace(/[$\\^*+?.()|[\]{}]/g, '\\$&');

const readerAliasesIn = (source: string): string[] => {
  const names = new Set<string>();
  for (const pattern of [ARROW_READER, FUNCTION_READER]) {
    pattern.lastIndex = 0;
    for (;;) {
      const match = pattern.exec(source);
      if (match?.[1] === undefined) break;
      names.add(match[1]);
    }
  }
  return [...names];
};

const readHintFor = (source: string): RegExp => {
  const aliases = readerAliasesIn(source);
  if (aliases.length === 0) return SOURCE_HINT;
  const alternation = aliases.map(escapeForRegExp).join('|');
  return new RegExp(`${SOURCE_HINT.source}|(?<![\\w$])(?:${alternation})\\(`);
};

const READER_SHAPES: Array<[string, string, boolean]> = [
  ['single-line arrow', "const read = (p: string) => readFileSync(join(R, p), 'utf-8');", true],
  [
    'arrow wrapped by the formatter',
    "const read = (relativePathToFile: string) =>\n  readFileSync(join(R, relativePathToFile), 'utf-8');",
    true,
  ],
  ['block-body arrow', 'const read = (p: string) => {\n  return readFileSync(p);\n};', true],
  ['function declaration', 'function read(p: string) {\n  return readFileSync(p);\n}', true],
  ['dollar-prefixed name', "const $read = (p: string) => readFileSync(p, 'utf-8');", true],
  ['async arrow', 'const read = async (p: string) => readFile(p);', true],
  [
    'result binding, not a reader',
    "const pkg = JSON.parse(readFileSync('package.json', 'utf8'));",
    false,
  ],
];

describe('meta: the read detector itself', () => {
  it.each(READER_SHAPES)('%s -> alias detected: %j', (_shape, source, shouldDetect) => {
    const detected = readerAliasesIn(source).length > 0;

    expect(
      detected,
      `readHintFor is the ONLY thing standing between this gate and a silent bypass, and its success looks exactly like its failure: a missed alias just leaves the suite green. So it is gated here, not by "the tree is clean".\n\nThe formatter-wrapped case is not hypothetical — the live helper lines are 97 chars against biome lineWidth 100, so ONE longer parameter name makes \`pnpm check:fix\` split the arrow, and a line-local detector stops seeing it. The dollar case is a silent fail-open too: \`$\` is a legal identifier char AND a regex end-anchor, so an unescaped \`$read\` compiles to a pattern that can never match.\n\nThe last row must NOT detect: it binds the RESULT of a read, not a reader. Registering it would add a junk alias and, on a name collision, someone would silence the gate with an allow-tag — re-decorating the tag this gate exists to keep load-bearing.`,
    ).toBe(shouldDetect);
  });
});

describe('meta: tests assert behavior, not source', () => {
  it('no test reads application source for a structural assertion', () => {
    const violations: string[] = [];
    for (const file of walk(ROOT_DIR)) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      const sourceHint = readHintFor(source);
      lines.forEach((line, i) => {
        if (!sourceHint.test(line)) return;
        if (IMPORT_LINE.test(line)) return;
        if (!TARGETS_APP_SOURCE.test(callText(lines, i))) return;
        if (isAllowTagged(lines, i)) return;
        violations.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(violations, `source-grep test assertions:\n${violations.join('\n')}`).toEqual([]);
  });
});
