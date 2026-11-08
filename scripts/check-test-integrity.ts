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
const MODULE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];
const ALIAS_PREFIX = '@/';
const RELATIVE_PREFIX = '.';
const REASON_ARGUMENT_INDEX = 1;
const MIN_TITLE_AND_BODY_ARGUMENTS = 2;
const DEFAULT_EXPORT = 'default';
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
