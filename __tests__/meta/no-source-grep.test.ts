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
const BINDING = '(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::(?:[^=;\\n]|=>)*)?=\\s*';
const NAMESPACE = '(?:[A-Za-z_$][\\w$]*\\.)*';
const ARROW_READER = new RegExp(
  `${BINDING}(?:async\\s+)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>[\\s\\S]{0,${READER_BODY}}?(?:readFileSync|readFile\\()`,
  'g',
);
const FUNCTION_READER = new RegExp(
  `${BINDING}(?:async\\s+)?function\\b[^{]*\\{[\\s\\S]{0,${READER_BODY}}?(?:readFileSync|readFile\\()|function\\s+([A-Za-z_$][\\w$]*)\\s*\\([^)]*\\)[\\s\\S]{0,${READER_BODY}}?(?:readFileSync|readFile\\()`,
  'g',
);
const BOUND_READER = new RegExp(
  `${BINDING}(?:promisify\\(\\s*)?${NAMESPACE}(?:readFileSync|readFile)\\b\\s*(?![\\w$(])`,
  'g',
);

const escapeForRegExp = (name: string) => name.replace(/[$\\^*+?.()|[\]{}]/g, '\\$&');

const readerAliasesIn = (source: string): string[] => {
  const names = new Set<string>();
  for (const pattern of [ARROW_READER, FUNCTION_READER, BOUND_READER]) {
    pattern.lastIndex = 0;
    for (;;) {
      const match = pattern.exec(source);
      if (match === null) break;
      pattern.lastIndex = match.index + 1;
      const name = match[1] ?? match[2];
      if (name !== undefined) names.add(name);
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

const READER_SHAPES: Array<[string, string, string | null]> = [
  ['single-line arrow', "const read = (p: string) => readFileSync(join(R, p), 'utf-8');", 'read'],
  [
    'arrow wrapped by the formatter',
    "const read = (relativePathToFile: string) =>\n  readFileSync(join(R, relativePathToFile), 'utf-8');",
    'read',
  ],
  ['block-body arrow', 'const read = (p: string) => {\n  return readFileSync(p);\n};', 'read'],
  ['function declaration', 'function read(p: string) {\n  return readFileSync(p);\n}', 'read'],
  ['dollar-prefixed name', "const $read = (p: string) => readFileSync(p, 'utf-8');", '$read'],
  ['async arrow', 'const read = async (p: string) => readFile(p);', 'read'],
  ['bare rebind', 'const read = readFileSync;', 'read'],
  ['namespaced rebind', 'const read = fs.readFileSync;', 'read'],
  [
    'anonymous function expression',
    'const read = function (p) {\n  return readFileSync(p);\n};',
    'read',
  ],
  ['promisified', 'const read = promisify(fs.readFile);', 'read'],
  ['non-fs namespace', 'const read = fsp.readFile;', 'read'],
  ['nested namespace', 'const read = fs.promises.readFile;', 'read'],
  ['type-annotated binding', 'const read: Reader = readFileSync;', 'read'],
  ['type-annotated arrow', 'const read: Reader = (p: string) => readFileSync(p);', 'read'],
  ['function-type annotation', 'const read: (p: string) => string = readFileSync;', 'read'],
  [
    'annotated declaration above a reader (must not shadow it)',
    'let cached: string | undefined;\nconst read = fs.readFileSync;',
    'read',
  ],
  [
    'a preceding helper must not swallow the reader below it',
    "const norm = (s: string) => s.trim();\nconst read = (p: string) => readFileSync(join(R, p), 'utf-8');",
    'read',
  ],
  [
    'result binding, not a reader',
    "const pkg = JSON.parse(readFileSync('package.json', 'utf8'));",
    null,
  ],
  ['call result, not a reader', "const raw = readFileSync('package.json', 'utf8');", null],
];

describe('meta: the read detector itself', () => {
  it.each(READER_SHAPES)('%s -> alias: %j', (_shape, source, expected) => {
    const aliases = readerAliasesIn(source);
    const detected = expected === null ? aliases.length === 0 : aliases.includes(expected);

    expect(
      detected,
      `readHintFor is the ONLY thing standing between this gate and a silent bypass, and its success looks exactly like its failure: a missed alias just leaves the suite green. So it is gated here, not by "the tree is clean".\n\nThe formatter-wrapped case is not hypothetical — the live helper lines are 97 chars against biome lineWidth 100, so ONE longer parameter name makes \`pnpm check:fix\` split the arrow, and a line-local detector stops seeing it. The dollar case is a silent fail-open too: \`$\` is a legal identifier char AND a regex end-anchor, so an unescaped \`$read\` compiles to a pattern that can never match.\n\nThe two false rows must NOT detect: they bind the RESULT of a read, not a reader. Registering them would add junk aliases and, on a name collision, someone would silence the gate with an allow-tag — re-decorating the tag this gate exists to keep load-bearing.\n\nThe rebind rows exist because requiring a FUNCTION initializer regressed them: a bare "const read = readFileSync" is the simplest alias there is, it was caught before that change, and it went green. A detector that only sees the shapes its author happened to think of is the same fail-open in a different coat.`,
    ).toBe(true);
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
