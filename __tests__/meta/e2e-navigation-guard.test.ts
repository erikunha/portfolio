import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { trackedFiles } from '../../scripts/lib/git';

const ROOT_DIR = process.cwd();
const GUARD_MODULE = 'tests/e2e/_helpers/test.ts';
const PLAYWRIGHT_MODULES = new Set(['@playwright/test', 'playwright/test', 'playwright']);
const TEST_BINDING = 'test';
const BROWSER_TYPES = new Set(['chromium', 'firefox', 'webkit']);
const LAUNCHERS = new Set(['launch', 'launchPersistentContext', 'connect', 'connectOverCDP']);
const GUARD_CALL = 'guardBrowser';
const PLAYWRIGHT_SOURCE = /^tests\/.*\.ts$|\.e2e\.ts$/;

interface Violation {
  file: string;
  line: number;
  text: string;
}

function visit(node: ts.Node, callback: (child: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function importsTestValue(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (clause === undefined || clause.isTypeOnly) return false;
  if (clause.name !== undefined) return true;
  const bindings = clause.namedBindings;
  if (bindings === undefined) return false;
  if (ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some(
    (element) =>
      !element.isTypeOnly && (element.propertyName ?? element.name).text === TEST_BINDING,
  );
}

function isUnguardedLaunch(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || !LAUNCHERS.has(callee.name.text)) return false;
  if (!ts.isIdentifier(callee.expression) || !BROWSER_TYPES.has(callee.expression.text)) {
    return false;
  }
  let holder: ts.Node = node.parent;
  while (ts.isAwaitExpression(holder) || ts.isParenthesizedExpression(holder)) {
    holder = holder.parent;
  }
  return !(
    ts.isCallExpression(holder) &&
    ts.isIdentifier(holder.expression) &&
    holder.expression.text === GUARD_CALL
  );
}

function findViolations(file: string, text: string): Violation[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
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
      ts.isStringLiteral(node.moduleSpecifier) &&
      PLAYWRIGHT_MODULES.has(node.moduleSpecifier.text) &&
      importsTestValue(node)
    ) {
      record(node);
    }
    if (ts.isCallExpression(node) && isUnguardedLaunch(node)) record(node);
  });
  return violations;
}

function repositoryViolations(): Violation[] {
  return trackedFiles()
    .filter((file) => PLAYWRIGHT_SOURCE.test(file) && file !== GUARD_MODULE)
    .flatMap((file) =>
      // behavioral-test-allow: the Playwright sources are the artifact under test; the property is that every page they drive comes from the navigation guard
      findViolations(file, readFileSync(join(ROOT_DIR, file), 'utf8')),
    );
}

const hits = (source: string) => findViolations('spec.ts', source).length;

describe('meta: every Playwright navigation goes through the WebKit stall guard', () => {
  it('sees test imported from Playwright itself, under any spelling', () => {
    expect(hits("import { expect, test } from '@playwright/test';")).toBe(1);
    expect(hits("import { test as base, type Page } from '@playwright/test';")).toBe(1);
    expect(hits("import { test } from 'playwright/test';")).toBe(1);
    expect(hits("import base from '@playwright/test';")).toBe(1);
    expect(hits("import * as pw from '@playwright/test';")).toBe(1);
  });

  it('accepts types and expect from Playwright, and test from the guard module', () => {
    expect(hits("import type { Page } from '@playwright/test';")).toBe(0);
    expect(hits("import { expect, type Page, type test } from '@playwright/test';")).toBe(0);
    expect(hits("import { expect, test } from './_helpers/test';")).toBe(0);
    expect(hits("import { test } from '../../../tests/e2e/_helpers/test';")).toBe(0);
  });

  it('sees a browser launched outside the guard', () => {
    expect(hits('const b = await chromium.launch();')).toBe(1);
    expect(hits('browser = await webkit.launch({ headless: true });')).toBe(1);
    expect(hits('const c = await firefox.launchPersistentContext(dir);')).toBe(1);
    expect(hits('const b = await chromium.connectOverCDP(url);')).toBe(1);
  });

  it('accepts a launched browser handed to guardBrowser', () => {
    expect(hits('browser = guardBrowser(await chromium.launch({ args }));')).toBe(0);
    expect(hits('const b = guardBrowser((await webkit.launch()));')).toBe(0);
  });

  it('no Playwright source bypasses the guard', () => {
    expect(
      repositoryViolations().map(
        (violation) => `${violation.file}:${violation.line}  ${violation.text}`,
      ),
      `WebKit can drop a first navigation from about:blank and leave page.goto waiting until the test times out (DECISIONS.md 2026-11-23). ${GUARD_MODULE} extends test so every page.goto on WebKit recovers that one stall. Import test and expect from it, compose a new test.extend on top of it, and pass a browser you launch yourself through guardBrowser.`,
    ).toEqual([]);
  });
});
