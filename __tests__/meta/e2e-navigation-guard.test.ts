import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, normalize } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { trackedFiles } from '../../scripts/lib/git';
import { VALIDATED_PLAYWRIGHT_VERSION } from '../../tests/e2e/_helpers/navigation-stall';

const ROOT_DIR = process.cwd();
const GUARD_MODULE = 'tests/e2e/_helpers/test.ts';
const GUARD_SPECIFIER = /(^|\/)_helpers\/test$/;
const PLAYWRIGHT_MODULES = new Set(['@playwright/test', 'playwright/test', 'playwright']);
const TEST_BINDINGS = new Set(['test', 'default']);
const BROWSER_TYPES = new Set(['chromium', 'firefox', 'webkit']);
const BROWSER_TYPE_FIXTURE = 'browserType';
const CONTEXT_GUARD_MIN_ARGUMENTS = 2;
const GUARDED_LAUNCHERS = new Set(['launch', 'connect', 'connectOverCDP']);
const PERSISTENT_LAUNCHER = 'launchPersistentContext';
const GUARD_CALL = 'guardBrowser';
const CONTEXT_GUARD_CALL = 'guardContext';
const REQUIRE_CALL = 'require';
const PLAYWRIGHT_SOURCE = /^tests\/.*\.ts$|\.e2e\.ts$/;
const CONFIG_TEST_DIR = 'tests';
const LIST_TIMEOUT_MS = 120_000;
const LIST_BUFFER_BYTES = 256 * 1024 * 1024;

interface Violation {
  file: string;
  line: number;
  text: string;
}

function visit(node: ts.Node, callback: (child: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function moduleText(node: ts.Expression | undefined): string | undefined {
  return node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined;
}

function isPlaywrightModule(node: ts.Expression | undefined): boolean {
  const text = moduleText(node);
  return text !== undefined && PLAYWRIGHT_MODULES.has(text);
}

function exportedName(element: ts.ImportSpecifier | ts.ExportSpecifier): string {
  return (element.propertyName ?? element.name).text;
}

function importsTestValue(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (clause === undefined || clause.isTypeOnly) return false;
  if (clause.name !== undefined) return true;
  const bindings = clause.namedBindings;
  if (bindings === undefined) return false;
  if (ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some(
    (element) => !element.isTypeOnly && TEST_BINDINGS.has(exportedName(element)),
  );
}

function reexportsTest(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return false;
  const clause = node.exportClause;
  if (clause === undefined || ts.isNamespaceExport(clause)) return true;
  return clause.elements.some(
    (element) => !element.isTypeOnly && TEST_BINDINGS.has(exportedName(element)),
  );
}

function isPlaywrightLoad(node: ts.CallExpression): boolean {
  const loader =
    node.expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(node.expression) && node.expression.text === REQUIRE_CALL);
  return loader && isPlaywrightModule(node.arguments[0]);
}

function browserTypeBindings(source: ts.SourceFile): {
  names: Set<string>;
  namespaces: Set<string>;
} {
  const names = new Set(BROWSER_TYPES);
  const namespaces = new Set<string>();
  visit(source, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    const specifier = moduleText(node.moduleSpecifier) ?? '';
    if (!PLAYWRIGHT_MODULES.has(specifier) && !GUARD_SPECIFIER.test(specifier)) return;
    const bindings = node.importClause?.namedBindings;
    if (bindings === undefined) return;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
      return;
    }
    for (const element of bindings.elements) {
      if (BROWSER_TYPES.has(exportedName(element))) names.add(element.name.text);
    }
  });
  return { names, namespaces };
}

function isBrowserType(
  node: ts.Expression,
  bindings: { names: Set<string>; namespaces: Set<string> },
): boolean {
  if (ts.isIdentifier(node)) {
    return bindings.names.has(node.text) || node.text === BROWSER_TYPE_FIXTURE;
  }
  return ts.isPropertyAccessExpression(node) && BROWSER_TYPES.has(node.name.text);
}

function launchVerdict(
  node: ts.CallExpression,
  bindings: { names: Set<string>; namespaces: Set<string> },
): 'none' | 'guarded' | 'violation' {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || !isBrowserType(callee.expression, bindings)) {
    return 'none';
  }
  const persistent = callee.name.text === PERSISTENT_LAUNCHER;
  if (!persistent && !GUARDED_LAUNCHERS.has(callee.name.text)) return 'none';
  let holder: ts.Node = node.parent;
  while (ts.isAwaitExpression(holder) || ts.isParenthesizedExpression(holder)) {
    holder = holder.parent;
  }
  const guarded =
    ts.isCallExpression(holder) &&
    ts.isIdentifier(holder.expression) &&
    holder.expression.text === (persistent ? CONTEXT_GUARD_CALL : GUARD_CALL) &&
    (!persistent || holder.arguments.length >= CONTEXT_GUARD_MIN_ARGUMENTS);
  return guarded ? 'guarded' : 'violation';
}

function findViolations(file: string, text: string): Violation[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const bindings = browserTypeBindings(source);
  const violations: Violation[] = [];
  const record = (node: ts.Node) =>
    violations.push({
      file,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text: node.getText().replace(/\s+/g, ' '),
    });
  visit(source, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      isPlaywrightModule(node.moduleSpecifier) &&
      importsTestValue(node)
    ) {
      record(node);
    }
    if (
      ts.isExportDeclaration(node) &&
      isPlaywrightModule(node.moduleSpecifier) &&
      reexportsTest(node)
    ) {
      record(node);
    }
    if (ts.isCallExpression(node) && isPlaywrightLoad(node)) record(node);
    if (ts.isCallExpression(node) && launchVerdict(node, bindings) === 'violation') record(node);
  });
  return violations;
}

function scannedSources(): string[] {
  return trackedFiles().filter(
    (file) =>
      PLAYWRIGHT_SOURCE.test(file) && file !== GUARD_MODULE && existsSync(join(ROOT_DIR, file)),
  );
}

function repositoryViolations(): Violation[] {
  return scannedSources().flatMap((file) =>
    // behavioral-test-allow: the Playwright sources are the artifact under test; the property is that every page they drive comes from the navigation guard
    findViolations(file, readFileSync(join(ROOT_DIR, file), 'utf8')),
  );
}

interface ListedSuite {
  file?: string;
  suites?: ListedSuite[];
}

function listedSpecFiles(): Set<string> {
  const output = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    maxBuffer: LIST_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: LIST_TIMEOUT_MS,
  });
  const files = new Set<string>();
  const walk = (suite: ListedSuite) => {
    if (suite.file) files.add(normalize(join(CONFIG_TEST_DIR, suite.file)));
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of (JSON.parse(output) as { suites: ListedSuite[] }).suites) walk(suite);
  return files;
}

const hits = (source: string) => findViolations('spec.ts', source).length;

describe('meta: every Playwright navigation goes through the WebKit stall guard', () => {
  it('sees test imported from Playwright itself, under any spelling', () => {
    expect(hits("import { expect, test } from '@playwright/test';")).toBe(1);
    expect(hits("import { test as base, type Page } from '@playwright/test';")).toBe(1);
    expect(hits("import { test } from 'playwright/test';")).toBe(1);
    expect(hits("import base from '@playwright/test';")).toBe(1);
    expect(hits("import { default as test } from '@playwright/test';")).toBe(1);
    expect(hits("import * as pw from '@playwright/test';")).toBe(1);
  });

  it('sees test re-exported or loaded at run time from Playwright itself', () => {
    expect(hits("export { test } from '@playwright/test';")).toBe(1);
    expect(hits("export * from '@playwright/test';")).toBe(1);
    expect(hits("export * as pw from '@playwright/test';")).toBe(1);
    expect(hits("const { test } = require('@playwright/test');")).toBe(1);
    expect(hits("const pw = await import('@playwright/test');")).toBe(1);
  });

  it('accepts types and expect from Playwright, and test from the guard module', () => {
    expect(hits("import type { Page } from '@playwright/test';")).toBe(0);
    expect(hits("import { expect, type Page, type test } from '@playwright/test';")).toBe(0);
    expect(hits("export type { Page } from '@playwright/test';")).toBe(0);
    expect(hits("import { expect, test } from './_helpers/test';")).toBe(0);
    expect(hits("import { test } from '../../../tests/e2e/_helpers/test';")).toBe(0);
  });

  it('sees a browser launched outside the guard, under any binding', () => {
    expect(hits('const b = await chromium.launch();')).toBe(1);
    expect(hits('browser = await webkit.launch({ headless: true });')).toBe(1);
    expect(hits('const b = await chromium.connectOverCDP(url);')).toBe(1);
    const aliased = "import { chromium as c } from './_helpers/test';\nconst b = await c.launch();";
    expect(hits(aliased)).toBe(1);
    const namespaced = "import * as pw from 'playwright';\nconst b = await pw.webkit.launch();";
    expect(hits(namespaced)).toBe(2);
  });

  it('takes a persistent context only through guardContext, which is told the browser type', () => {
    expect(hits('const c = await firefox.launchPersistentContext(dir);')).toBe(1);
    expect(hits('guardBrowser(await webkit.launchPersistentContext(dir));')).toBe(1);
    expect(hits('guardContext(await webkit.launchPersistentContext(dir));')).toBe(1);
    expect(hits('guardContext(await webkit.launchPersistentContext(dir), webkit);')).toBe(0);
  });

  it('sees a browser launched from the browserType fixture outside the guard', () => {
    expect(hits('async ({ browserType }) => { await browserType.launch(); }')).toBe(1);
    expect(hits('async ({ browserType }) => { guardBrowser(await browserType.launch()); }')).toBe(
      0,
    );
  });

  it('accepts a launched browser handed to guardBrowser', () => {
    expect(hits('browser = guardBrowser(await chromium.launch({ args }));')).toBe(0);
    expect(hits('const b = guardBrowser((await webkit.launch()));')).toBe(0);
    const aliased =
      "import { webkit as w } from './_helpers/test';\nguardBrowser(await w.launch());";
    expect(hits(aliased)).toBe(0);
  });

  it(
    'scans every spec file the Playwright config selects, and no committed probe',
    () => {
      const scanned = new Set(scannedSources());
      const listed = [...listedSpecFiles()];
      expect(listed.length).toBeGreaterThan(0);
      expect(listed.filter((file) => !scanned.has(file))).toEqual([]);
      expect(listed.filter((file) => file.startsWith('scripts/'))).toEqual([]);
    },
    LIST_TIMEOUT_MS,
  );

  it('no Playwright source bypasses the guard', () => {
    expect(
      repositoryViolations().map(
        (violation) => `${violation.file}:${violation.line}  ${violation.text}`,
      ),
      `WebKit can drop a first navigation from about:blank and leave page.goto waiting until the test times out (DECISIONS.md 2026-11-23). ${GUARD_MODULE} extends test so every page.goto on WebKit recovers that one stall. Import test from it, compose a new test.extend on top of it, pass a browser you launch yourself through guardBrowser, and a persistent context through guardContext with its browser type.`,
    ).toEqual([]);
  });

  it('runs on the Playwright version the containment was validated against', () => {
    const installed = (
      createRequire(import.meta.url)('@playwright/test/package.json') as { version: string }
    ).version;
    expect(
      installed,
      `the WebKit COOP stall containment was validated on Playwright ${VALIDATED_PLAYWRIGHT_VERSION}. After a bump, run scripts/e2e/webkit-stall-probe.sh on the new version, inside the mcr.microsoft.com/playwright:v<version>-noble image: 12,000 clean unguarded navigations mean the upstream fix landed and the containment goes (DECISIONS.md 2026-11-23); a stall means VALIDATED_PLAYWRIGHT_VERSION moves to the new version.`,
    ).toBe(VALIDATED_PLAYWRIGHT_VERSION);
  });
});
