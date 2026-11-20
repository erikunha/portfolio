#!/usr/bin/env tsx
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { isMain } from '../lib/is-main';
import { listFiles } from '../lib/walk';

export type ViolationKind =
  | 'fixed-wait'
  | 'focused'
  | 'no-assertion'
  | 'skip-without-reason'
  | 'source-grep';
export type Violation = { file: string; line: number; kind: ViolationKind };
export type ScanResult = { files: number; violations: Violation[] };

const TEST_FILE = /\.(test|spec|e2e)\.[cm]?[jt]sx?$/;
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

const TEST_ROOTS = new Set(['test', 'it']);
const SUITE_ROOTS = new Set(['describe', 'suite']);
const SUITE_MEMBERS = new Set(['describe', 'serial', 'parallel']);
const SUITE_KEYWORDS = new Set(['describe', 'suite']);
const DECLARATION_MODIFIERS = new Set([
  'only',
  'skip',
  'fixme',
  'fail',
  'fails',
  'concurrent',
  'sequential',
  'each',
  'for',
  'skipIf',
  'runIf',
  'todo',
]);
const FOCUS_MODIFIER = 'only';
const SKIP_MODIFIERS = new Set(['skip', 'fixme']);
const ASSERTION_ROOTS = new Set(['expect', 'assert', 'expectTypeOf', 'assertType']);
const SNAPSHOT_MATCHERS = new Set([
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toMatchFileSnapshot',
  'toHaveScreenshot',
]);
const ROOT_SKIP_DIRS = new Set(['out', 'build']);
const TEST_DIRS = new Set(['__tests__', 'tests']);
const ANY_SCRIPT = /\.[cm]?[jt]sx?$/;
const TYPE_DECL = /\.d\.ts$/;
const SOURCE_HINT = /readFileSync|readFile\(/;
const TARGETS_APP_SOURCE = /['"`](?:[^'"`]*\/)?(app|components|lib|scripts)(\/|['"`])/;
const ALLOW_TAG = /behavioral-test-allow:/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;
const IMPORT_LINE = /^\s*import\b/;
const CALL_LOOKAHEAD_LINES = 3;
const STRING_LITERAL = /(['"`])(?:\\.|(?!\1).)*?\1/g;
const LINE_COMMENT = /\/\/.*$/;
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
const MODULE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];
const ALIAS_PREFIX = '@/';
const RELATIVE_PREFIX = '.';
const REASON_ARGUMENT_INDEX = 1;
const MIN_TITLE_AND_BODY_ARGUMENTS = 2;
const DEFAULT_EXPORT = 'default';
const TIMER_NAME = 'setTimeout';
const TIMER_HOSTS = new Set(['window', 'globalThis', 'self']);
const PROMISE_NAME = 'Promise';
const TIMER_DELAY_INDEX = 1;
const NODE_KEY_SEPARATOR = '\0';

type FunctionLike = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

function isFunctionLike(node: ts.Node | undefined): node is FunctionLike {
  return (
    node !== undefined &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))
  );
}

type TransparentWrapper =
  | ts.AsExpression
  | ts.NonNullExpression
  | ts.ParenthesizedExpression
  | ts.SatisfiesExpression
  | ts.TypeAssertion;

function isTransparentWrapper(node: ts.Node): node is TransparentWrapper {
  return (
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  );
}

function memberChain(expression: ts.Expression): string[] {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    return [...memberChain(expression.expression), expression.name.text];
  }
  if (ts.isElementAccessExpression(expression)) {
    const key = expression.argumentExpression;
    if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
      return [...memberChain(expression.expression), key.text];
    }
    return [];
  }
  if (isTransparentWrapper(expression)) return memberChain(expression.expression);
  if (ts.isCallExpression(expression)) return memberChain(expression.expression);
  if (ts.isTaggedTemplateExpression(expression)) return memberChain(expression.tag);
  return [];
}

function isAssertionCall(chain: string[]): boolean {
  const [root] = chain;
  const last = chain[chain.length - 1];
  return (
    (root !== undefined && ASSERTION_ROOTS.has(root)) ||
    (last !== undefined && SNAPSHOT_MATCHERS.has(last))
  );
}

function isNumericTimerCall(call: ts.CallExpression): boolean {
  const chain = memberChain(call.expression);
  const [first] = chain;
  const isTimer =
    (chain.length === 1 && first === TIMER_NAME) ||
    (chain.length === 2 && first !== undefined && TIMER_HOSTS.has(first) && chain[1] === TIMER_NAME);
  const delay = call.arguments[TIMER_DELAY_INDEX];
  return isTimer && delay !== undefined && ts.isNumericLiteral(delay);
}

function isFixedWait(node: ts.AwaitExpression): boolean {
  const awaited = node.expression;
  if (!ts.isNewExpression(awaited)) return false;
  if (!ts.isIdentifier(awaited.expression) || awaited.expression.text !== PROMISE_NAME) return false;
  return collectCalls(awaited).some(isNumericTimerCall);
}

function collectCalls(node: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child)) calls.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return calls;
}

function collectLocalFunctions(sourceFile: ts.SourceFile): Map<string, FunctionLike> {
  const functions = new Map<string, FunctionLike>();
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      functions.set(node.name.text, node);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (node.initializer === undefined ? false : isFunctionLike(node.initializer))
    ) {
      functions.set(node.name.text, node.initializer as FunctionLike);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return functions;
}

function findAssertingHelpers(
  functions: Map<string, FunctionLike>,
  imported: ReadonlySet<string>,
): Set<string> {
  const asserting = new Set<string>(imported);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, fn] of functions) {
      if (asserting.has(name)) continue;
      if (containsAssertion(fn, asserting)) {
        asserting.add(name);
        grew = true;
      }
    }
  }
  return asserting;
}

function containsAssertion(node: ts.Node, assertingHelpers: Set<string>): boolean {
  return collectCalls(node).some((call) => {
    const chain = memberChain(call.expression);
    if (isAssertionCall(chain)) return true;
    const [callee] = chain;
    return callee !== undefined && assertingHelpers.has(callee);
  });
}

type Declaration = { isSuite: boolean; modifiers: string[] };

function describeDeclaration(chain: string[]): Declaration | undefined {
  const [root, ...members] = chain;
  if (root === undefined) return undefined;
  const isSuiteRoot = SUITE_ROOTS.has(root);
  if (!isSuiteRoot && !TEST_ROOTS.has(root)) return undefined;
  const modifiers = members.filter((m) => DECLARATION_MODIFIERS.has(m));
  const structure = members.filter((m) => !DECLARATION_MODIFIERS.has(m));
  if (structure.some((m) => !SUITE_MEMBERS.has(m))) return undefined;
  const isSuite = isSuiteRoot || structure.some((m) => SUITE_KEYWORDS.has(m));
  return { isSuite, modifiers };
}

function isTitleAndBodyForm(call: ts.CallExpression): boolean {
  const [first] = call.arguments;
  const last = call.arguments[call.arguments.length - 1];
  if (call.arguments.length < MIN_TITLE_AND_BODY_ARGUMENTS) return false;
  if (isFunctionLike(last)) return true;
  return (
    last !== undefined &&
    ts.isIdentifier(last) &&
    first !== undefined &&
    (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
  );
}

function resolveBody(
  call: ts.CallExpression,
  functions: Map<string, FunctionLike>,
): ts.Node | undefined {
  const last = call.arguments[call.arguments.length - 1];
  if (isFunctionLike(last)) return last;
  if (last !== undefined && ts.isIdentifier(last)) return functions.get(last.text);
  return undefined;
}

function hasReason(call: ts.CallExpression): boolean {
  const reason = call.arguments[REASON_ARGUMENT_INDEX];
  if (reason === undefined) return false;
  if (ts.isStringLiteral(reason) || ts.isNoSubstitutionTemplateLiteral(reason)) {
    return reason.text.trim() !== '';
  }
  return true;
}

function parse(source: string, file: string): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

export function findViolations(
  source: string,
  file: string,
  importedAssertingHelpers: ReadonlySet<string> = new Set(),
): Violation[] {
  return [
    ...inspectSourceFile(parse(source, file), file, importedAssertingHelpers),
    ...findSourceGrepViolations(source, file),
  ];
}

function inspectSourceFile(
  sourceFile: ts.SourceFile,
  file: string,
  importedAssertingHelpers: ReadonlySet<string>,
): Violation[] {
  const functions = collectLocalFunctions(sourceFile);
  const assertingHelpers = findAssertingHelpers(functions, importedAssertingHelpers);
  const found = new Map<string, Violation>();

  const report = (node: ts.Node, kind: ViolationKind) => {
    const start = node.getStart(sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(start);
    found.set(`${kind}:${start}`, { file, line: line + 1, kind });
  };

  const inspect = (call: ts.CallExpression) => {
    const declaration = describeDeclaration(memberChain(call.expression));
    if (declaration === undefined) return;
    const { isSuite, modifiers } = declaration;
    const titleAndBody = isTitleAndBodyForm(call);
    if (modifiers.includes(FOCUS_MODIFIER)) report(call, 'focused');
    const skipped = modifiers.some((m) => SKIP_MODIFIERS.has(m));
    if (skipped && (titleAndBody || !hasReason(call))) report(call, 'skip-without-reason');
    if (isSuite || skipped || !titleAndBody) return;
    const body = resolveBody(call, functions);
    if (body !== undefined && !containsAssertion(body, assertingHelpers)) {
      report(call, 'no-assertion');
    }
  };

  const lines = sourceFile.text.split('\n');
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) inspect(node);
    if (ts.isAwaitExpression(node) && isFixedWait(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      if (!isAllowTagged(lines, line)) report(node, 'fixed-wait');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...found.values()];
}

function collectTestFiles(dir: string): string[] {
  return listFiles(dir, { include: TEST_FILE, skipDirs: SKIP_DIRS }).map((rel) => join(dir, rel));
}

function isTestCode(rel: string): boolean {
  const segments = rel.split(sep);
  const name = segments[segments.length - 1] ?? '';
  if (ROOT_SKIP_DIRS.has(segments[0] ?? '')) return false;
  if (TYPE_DECL.test(name)) return false;
  const insideTestDir = segments.slice(0, -1).some((segment) => TEST_DIRS.has(segment));
  return insideTestDir ? ANY_SCRIPT.test(name) : TEST_FILE.test(name);
}

function collectTestCodeFiles(dir: string): string[] {
  return listFiles(dir, { include: ANY_SCRIPT, skipDirs: SKIP_DIRS })
    .filter(isTestCode)
    .map((rel) => join(dir, rel));
}

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

const escapeForRegExp = (name: string) => name.replace(/[$\\^*+?.()|[\]{}]/g, '\\$&');

export function readerAliasesIn(source: string): string[] {
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
}

function readHintFor(source: string): RegExp {
  const aliases = readerAliasesIn(source);
  if (aliases.length === 0) return SOURCE_HINT;
  const alternation = aliases.map(escapeForRegExp).join('|');
  return new RegExp(`${SOURCE_HINT.source}|(?<![\\w$])(?:${alternation})\\(`);
}

function findSourceGrepViolations(source: string, file: string): Violation[] {
  const lines = source.split('\n');
  const sourceHint = readHintFor(source);
  const found: Violation[] = [];
  lines.forEach((line, i) => {
    if (!sourceHint.test(line)) return;
    if (IMPORT_LINE.test(line)) return;
    if (!TARGETS_APP_SOURCE.test(callText(lines, i))) return;
    if (isAllowTagged(lines, i)) return;
    found.push({ file, line: i + 1, kind: 'source-grep' });
  });
  return found;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function resolveModule(root: string, fromFile: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith(RELATIVE_PREFIX)) base = resolve(dirname(fromFile), specifier);
  else if (specifier.startsWith(ALIAS_PREFIX)) {
    base = resolve(root, specifier.slice(ALIAS_PREFIX.length));
  } else return undefined;
  const candidates = [
    base,
    ...MODULE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...MODULE_EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  return candidates.find(isFile);
}

type ImportBinding = { target: string; imported: string };
type ExportEntry = { local: string } | ImportBinding;
type ModuleInfo = {
  sourceFile: ts.SourceFile;
  functions: Map<string, FunctionLike>;
  imports: Map<string, ImportBinding>;
  exports: Map<string, ExportEntry>;
  stars: string[];
};
type HelperRef = { key: string; file: string; fn: FunctionLike };
type HelperNode = { direct: boolean; deps: HelperRef[] };

function hasDefaultModifier(node: ts.FunctionDeclaration): boolean {
  return ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

function readModule(root: string, file: string): ModuleInfo {
  const sourceFile = parse(readFileSync(file, 'utf8'), file);
  const functions = collectLocalFunctions(sourceFile);
  const imports = new Map<string, ImportBinding>();
  const exports = new Map<string, ExportEntry>();
  const stars: string[] = [];
  const targetOf = (specifier: ts.Expression | undefined) =>
    specifier !== undefined && ts.isStringLiteral(specifier)
      ? resolveModule(root, file, specifier.text)
      : undefined;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const target = targetOf(statement.moduleSpecifier);
      const clause = statement.importClause;
      if (target === undefined || clause === undefined) continue;
      if (clause.name !== undefined) {
        imports.set(clause.name.text, { target, imported: DEFAULT_EXPORT });
      }
      const named = clause.namedBindings;
      if (named === undefined || !ts.isNamedImports(named)) continue;
      for (const element of named.elements) {
        imports.set(element.name.text, {
          target,
          imported: (element.propertyName ?? element.name).text,
        });
      }
    } else if (ts.isExportDeclaration(statement)) {
      const target = targetOf(statement.moduleSpecifier);
      const clause = statement.exportClause;
      if (clause === undefined) {
        if (target !== undefined) stars.push(target);
        continue;
      }
      if (!ts.isNamedExports(clause)) continue;
      for (const element of clause.elements) {
        const name = (element.propertyName ?? element.name).text;
        if (statement.moduleSpecifier === undefined) {
          exports.set(element.name.text, { local: name });
        } else if (target !== undefined) {
          exports.set(element.name.text, { target, imported: name });
        }
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const { expression } = statement;
      if (isFunctionLike(expression)) functions.set(DEFAULT_EXPORT, expression);
      else if (ts.isIdentifier(expression)) exports.set(DEFAULT_EXPORT, { local: expression.text });
    } else if (ts.isFunctionDeclaration(statement) && hasDefaultModifier(statement)) {
      if (statement.name === undefined) functions.set(DEFAULT_EXPORT, statement);
      else exports.set(DEFAULT_EXPORT, { local: statement.name.text });
    }
  }
  return { sourceFile, functions, imports, exports, stars };
}

function createImportedHelperResolver(root: string) {
  const modules = new Map<string, ModuleInfo>();
  const nodes = new Map<string, HelperNode>();
  const verdicts = new Map<string, boolean>();

  const moduleOf = (file: string): ModuleInfo => {
    const cached = modules.get(file);
    if (cached !== undefined) return cached;
    const module = readModule(root, file);
    modules.set(file, module);
    return module;
  };

  const functionRef = (file: string, name: string): HelperRef[] => {
    const fn = moduleOf(file).functions.get(name);
    return fn === undefined ? [] : [{ key: `${file}${NODE_KEY_SEPARATOR}${name}`, file, fn }];
  };

  const resolveLocal = (file: string, name: string, seen: Set<string>): HelperRef[] => {
    const local = functionRef(file, name);
    if (local.length > 0) return local;
    const binding = moduleOf(file).imports.get(name);
    return binding === undefined ? [] : resolveExport(binding.target, binding.imported, seen);
  };

  const resolveExport = (file: string, name: string, seen: Set<string>): HelperRef[] => {
    const visit = `${file}${NODE_KEY_SEPARATOR}${name}`;
    if (seen.has(visit)) return [];
    seen.add(visit);
    const module = moduleOf(file);
    const entry = module.exports.get(name);
    if (entry !== undefined) {
      return 'target' in entry
        ? resolveExport(entry.target, entry.imported, seen)
        : resolveLocal(file, entry.local, seen);
    }
    const direct = functionRef(file, name);
    if (direct.length > 0 || name === DEFAULT_EXPORT) return direct;
    return module.stars.flatMap((star) => resolveExport(star, name, seen));
  };

  const nodeOf = (ref: HelperRef): HelperNode => {
    const cached = nodes.get(ref.key);
    if (cached !== undefined) return cached;
    const deps = new Map<string, HelperRef>();
    let direct = false;
    for (const call of collectCalls(ref.fn)) {
      const chain = memberChain(call.expression);
      if (isAssertionCall(chain)) direct = true;
      const [callee] = chain;
      if (callee === undefined) continue;
      for (const dep of resolveLocal(ref.file, callee, new Set())) deps.set(dep.key, dep);
    }
    const node = { direct, deps: [...deps.values()] };
    nodes.set(ref.key, node);
    return node;
  };

  const isAsserting = (ref: HelperRef): boolean => {
    const known = verdicts.get(ref.key);
    if (known !== undefined) return known;
    const reachable = new Map<string, HelperNode>();
    const pending = [ref];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (reachable.has(next.key) || verdicts.has(next.key)) continue;
      const node = nodeOf(next);
      reachable.set(next.key, node);
      pending.push(...node.deps);
    }
    const asserting = new Set<string>();
    for (const [key, node] of reachable) if (node.direct) asserting.add(key);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [key, node] of reachable) {
        if (asserting.has(key)) continue;
        if (node.deps.some((dep) => asserting.has(dep.key) || verdicts.get(dep.key) === true)) {
          asserting.add(key);
          grew = true;
        }
      }
    }
    for (const key of reachable.keys()) verdicts.set(key, asserting.has(key));
    return asserting.has(ref.key);
  };

  const importedAssertingBindings = (file: string): Set<string> => {
    const bindings = new Set<string>();
    for (const [local, binding] of moduleOf(file).imports) {
      if (resolveExport(binding.target, binding.imported, new Set()).some(isAsserting)) {
        bindings.add(local);
      }
    }
    return bindings;
  };

  return { sourceFileOf: (file: string) => moduleOf(file).sourceFile, importedAssertingBindings };
}

export function scanRoot(root: string): ScanResult {
  const files = collectTestFiles(root).sort();
  const resolver = createImportedHelperResolver(root);
  const violations = files.flatMap((full) =>
    inspectSourceFile(
      resolver.sourceFileOf(full),
      relative(root, full),
      resolver.importedAssertingBindings(full),
    ),
  );
  const sourceGrep = collectTestCodeFiles(root).flatMap((full) =>
    findSourceGrepViolations(readFileSync(full, 'utf8'), relative(root, full)),
  );
  return { files: files.length, violations: [...violations, ...sourceGrep] };
}

const ADVICE: Record<ViolationKind, string> = {
  'fixed-wait':
    'a fixed real-time wait is flaky under load; wait for the condition with vi.waitFor, use fake timers, or tag the wait with behavioral-test-allow: and a reason',
  'source-grep':
    'a test that reads application source asserts text, not behavior; exercise the code, or tag the read with behavioral-test-allow: and a reason',
  focused: 'a focused test silently skips every other test in the run; remove the .only',
  'no-assertion':
    'a test body with no expect or assert passes whatever the code does; assert the behavior it protects',
  'skip-without-reason':
    'a skip must say why: use test.skip(condition, "reason") inside the body, or delete the test',
};

function main() {
  const root = resolve(process.argv[2] ?? process.cwd());
  const { files, violations } = scanRoot(root);
  if (violations.length > 0) {
    console.error('\n[check-test-integrity] test files with integrity violations:');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.kind}: ${ADVICE[v.kind]}`);
    }
    process.exit(1);
  }
  console.log(`[check-test-integrity] OK: ${files} test files checked.`);
}

if (isMain(import.meta.url)) main();
