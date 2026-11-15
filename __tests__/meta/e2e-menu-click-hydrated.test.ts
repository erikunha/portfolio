import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const SCAN_ROOT = 'tests';
const SPEC_FILE = /\.(spec|e2e)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'test-results', 'playwright-report']);
const TRIGGER_IDENTIFIERS = new Set(['MENU_TRIGGER', 'DOCK_MENU']);
const TRIGGER_TEXT = /menu-trigger|Open menu|Abrir menu/;
const HYDRATION_WAITS = ['openSectionMenu', 'waitForHydration', 'gotoHydrated'];
const TEST_ROOTS = new Set(['test', 'it']);
const SUITE_MEMBER = 'describe';
const SNIPPET_LENGTH = 100;

interface Violation {
  file: string;
  line: number;
  text: string;
}

type FunctionNode = ts.FunctionLikeDeclaration;

function visit(node: ts.Node, callback: (child: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function literalText(node: ts.Node): string | undefined {
  if (
    ts.isStringLiteralLike(node) ||
    ts.isRegularExpressionLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return node.text;
  }
  return undefined;
}

function referencesTrigger(node: ts.Node, bound: ReadonlySet<string>): boolean {
  let found = false;
  visit(node, (child) => {
    if (ts.isIdentifier(child) && (TRIGGER_IDENTIFIERS.has(child.text) || bound.has(child.text))) {
      found = true;
    }
    const text = literalText(child);
    if (text !== undefined && TRIGGER_TEXT.test(text)) found = true;
  });
  return found;
}

function isFunctionNode(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)
  );
}

function functionName(fn: FunctionNode): string | undefined {
  if (ts.isFunctionDeclaration(fn)) return fn.name?.text;
  const holder = fn.parent;
  return ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)
    ? holder.name.text
    : undefined;
}

function isTestCallback(fn: FunctionNode): boolean {
  const call = fn.parent;
  if (!ts.isCallExpression(call)) return false;
  const members: string[] = [];
  let callee: ts.Expression = call.expression;
  while (ts.isPropertyAccessExpression(callee)) {
    members.push(callee.name.text);
    callee = callee.expression;
  }
  return ts.isIdentifier(callee) && TEST_ROOTS.has(callee.text) && !members.includes(SUITE_MEMBER);
}

function enclosingScope(node: ts.Node): FunctionNode | undefined {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (isFunctionNode(current) && (functionName(current) !== undefined || isTestCallback(current)))
      return current;
  }
  return undefined;
}

function boundTriggerNames(source: ts.SourceFile): Set<string> {
  const declarations: ts.VariableDeclaration[] = [];
  visit(source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (!isFunctionNode(node.initializer)) declarations.push(node);
    }
  });
  const bound = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const declaration of declarations) {
      const name = (declaration.name as ts.Identifier).text;
      if (bound.has(name) || !declaration.initializer) continue;
      if (referencesTrigger(declaration.initializer, bound)) {
        bound.add(name);
        grew = true;
      }
    }
  }
  return bound;
}

function calls(node: ts.Node, name: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  visit(node, (child) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === name
    ) {
      found.push(child);
    }
  });
  return found;
}

function hydratingFunctions(source: ts.SourceFile): Set<string> {
  const waits = new Set(HYDRATION_WAITS);
  const named: { name: string; fn: FunctionNode }[] = [];
  visit(source, (node) => {
    const name = isFunctionNode(node) ? functionName(node) : undefined;
    if (isFunctionNode(node) && name !== undefined) named.push({ name, fn: node });
  });
  let grew = true;
  while (grew) {
    grew = false;
    for (const { name, fn } of named) {
      if (waits.has(name)) continue;
      if ([...waits].some((wait) => calls(fn, wait).length > 0)) {
        waits.add(name);
        grew = true;
      }
    }
  }
  return waits;
}

function findViolations(file: string, text: string): Violation[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const bound = boundTriggerNames(source);
  const waits = hydratingFunctions(source);

  function hydratedBefore(at: ts.Node, visiting: ReadonlySet<FunctionNode>): boolean {
    const scope = enclosingScope(at);
    if (scope === undefined || visiting.has(scope)) return false;
    const waited = [...waits].some((wait) =>
      calls(scope, wait).some((call) => call.getStart() < at.getStart()),
    );
    if (waited) return true;
    const name = functionName(scope);
    if (name === undefined) return false;
    const callers = calls(source, name).filter((call) => enclosingScope(call) !== scope);
    return (
      callers.length > 0 &&
      callers.every((call) => hydratedBefore(call, new Set([...visiting, scope])))
    );
  }

  const violations: Violation[] = [];
  visit(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.name.text !== 'click') return;
    const receiver = node.expression.expression;
    if (!referencesTrigger(receiver, bound) || hydratedBefore(node, new Set())) return;
    violations.push({
      file,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text: receiver.getText().replace(/\s+/g, ' ').slice(0, SNIPPET_LENGTH),
    });
  });
  return violations;
}

function specFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return specFiles(full);
    return SPEC_FILE.test(entry) ? [full] : [];
  });
}

function repositoryViolations(): Violation[] {
  return specFiles(join(ROOT_DIR, SCAN_ROOT)).flatMap((file) => {
    // behavioral-test-allow: the Playwright specs are the artifact under test; the property is that no spec clicks a client-island menu control before it hydrated
    const text = readFileSync(file, 'utf8');
    return findViolations(relative(ROOT_DIR, file), text);
  });
}

const inTest = (body: string) => `test('t', async ({ page }) => {\n${body}\n});`;
const hits = (source: string) => findViolations('spec.ts', source).length;

describe('meta: the section menu controls are clicked only after they hydrate', () => {
  it('sees a click on the trigger named by its accessible name', () => {
    expect(hits(inTest("await page.getByRole('button', { name: 'Open menu' }).click();"))).toBe(1);
    expect(hits(inTest("await page.getByRole('button', { name: /^Abrir menu$/ }).click();"))).toBe(
      1,
    );
  });

  it('sees a click on a locator built from the trigger selector', () => {
    expect(hits(inTest('await page.locator(MENU_TRIGGER).click();'))).toBe(1);
    expect(hits(inTest("await page.locator('.desktop-topbar .menu-trigger').click();"))).toBe(1);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is spec source text, not a template
    const interpolated = 'await page.locator(`${MENU_TRIGGER}:visible`).first().click();';
    expect(hits(inTest(interpolated))).toBe(1);
  });

  it('sees a click through a binding to the trigger', () => {
    const locator = "const t = page.getByRole('button', { name: 'Open menu' });\nawait t.click();";
    const name = "const n = 'Open menu';\nawait page.getByRole('button', { name: n }).click();";
    expect(hits(inTest(locator))).toBe(1);
    expect(hits(inTest(name))).toBe(1);
  });

  it('sees a click on the dock menu button selector', () => {
    expect(hits(inTest('await page.locator(DOCK_MENU).click();'))).toBe(1);
  });

  it('accepts a click after a hydration wait in the same test', () => {
    for (const wait of [
      "await gotoHydrated(page, '/', MENU_TRIGGER);",
      "await waitForHydration(page, '.menu-trigger');",
    ]) {
      expect(hits(inTest(`${wait}\nawait page.locator(MENU_TRIGGER).click();`))).toBe(0);
    }
  });

  it('accepts a click after a local helper that waits for hydration', () => {
    const helper = "async function open(page) { await gotoHydrated(page, '/', MENU_TRIGGER); }";
    const source = `${helper}\n${inTest('await open(page);\nawait page.locator(MENU_TRIGGER).click();')}`;
    expect(hits(source)).toBe(0);
  });

  it('accepts a click in a helper whose every caller hydrated first', () => {
    const helper = 'async function press(page) { await page.locator(MENU_TRIGGER).click(); }';
    const wait = "await gotoHydrated(page, '/', MENU_TRIGGER);";
    expect(hits(`${helper}\n${inTest(`${wait}\nawait press(page);`)}`)).toBe(0);
    expect(hits(`${helper}\n${inTest('await press(page);')}`)).toBe(1);
    expect(hits(helper)).toBe(1);
  });

  it('rejects a click before the wait and a click covered only by another test', () => {
    const wait = "await gotoHydrated(page, '/', MENU_TRIGGER);";
    const late = inTest(`await page.locator(MENU_TRIGGER).click();\n${wait}`);
    expect(hits(late)).toBe(1);
    const other = `${inTest(wait)}\n${inTest('await page.locator(MENU_TRIGGER).click();')}`;
    expect(hits(other)).toBe(1);
  });

  it('leaves the shared helper, other buttons and assertions alone', () => {
    expect(hits(inTest('await openSectionMenu(page);'))).toBe(0);
    expect(hits(inTest("await page.getByRole('button', { name: 'Submit' }).click();"))).toBe(0);
    expect(hits(inTest("await expect(trigger).toHaveAccessibleName('Open menu');"))).toBe(0);
  });

  it('no spec clicks a menu control before it hydrated', () => {
    expect(
      repositoryViolations().map(
        (violation) => `${violation.file}:${violation.line}  ${violation.text}`,
      ),
      'the menu trigger and the dock menu button are client islands, so a click before React hydrates them opens nothing and the spec fails on the assertion that follows. Open the section menu with openSectionMenu(page) from tests/e2e/_helpers/hydration.ts, or wait with gotoHydrated or waitForHydration before the click.',
    ).toEqual([]);
  });
});
