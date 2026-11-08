#!/usr/bin/env tsx
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export type ViolationKind = 'focused' | 'no-assertion' | 'skip-without-reason';
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
const MODULE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];
const ALIAS_PREFIX = '@/';
const RELATIVE_PREFIX = '.';
const REASON_ARGUMENT_INDEX = 1;
const MIN_TITLE_AND_BODY_ARGUMENTS = 2;

type FunctionLike = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

function isFunctionLike(node: ts.Node | undefined): node is FunctionLike {
  return (
    node !== undefined &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))
  );
}

function memberChain(expression: ts.Expression): string[] {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    return [...memberChain(expression.expression), expression.name.text];
  }
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
  return inspectSourceFile(parse(source, file), file, importedAssertingHelpers);
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

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) inspect(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...found.values()];
}

function collectTestFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectTestFiles(full);
    return TEST_FILE.test(entry.name) ? [full] : [];
  });
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

function createImportedHelperResolver(root: string) {
  const cache = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  const assertingNamesOf = (file: string): Set<string> => {
    const cached = cache.get(file);
    if (cached !== undefined) return cached;
    if (visiting.has(file)) return new Set();
    visiting.add(file);
    const sourceFile = parse(readFileSync(file, 'utf8'), file);
    const names = findAssertingHelpers(
      collectLocalFunctions(sourceFile),
      importedAssertingBindings(sourceFile, file),
    );
    visiting.delete(file);
    cache.set(file, names);
    return names;
  };

  const importedAssertingBindings = (sourceFile: ts.SourceFile, file: string): Set<string> => {
    const bindings = new Set<string>();
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      const named = statement.importClause?.namedBindings;
      if (named === undefined || !ts.isNamedImports(named)) continue;
      const target = resolveModule(root, file, statement.moduleSpecifier.text);
      if (target === undefined) continue;
      const asserting = assertingNamesOf(target);
      for (const specifier of named.elements) {
        if (asserting.has((specifier.propertyName ?? specifier.name).text)) {
          bindings.add(specifier.name.text);
        }
      }
    }
    return bindings;
  };

  return importedAssertingBindings;
}

export function scanRoot(root: string): ScanResult {
  const files = collectTestFiles(root).sort();
  const importedBindings = createImportedHelperResolver(root);
  const violations = files.flatMap((full) => {
    const sourceFile = parse(readFileSync(full, 'utf8'), full);
    return inspectSourceFile(sourceFile, relative(root, full), importedBindings(sourceFile, full));
  });
  return { files: files.length, violations };
}

const ADVICE: Record<ViolationKind, string> = {
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

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main();
}
