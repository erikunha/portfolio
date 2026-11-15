import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SHELL_DIR = 'components/client/InteractiveShell';
const PLACEHOLDER = `${SHELL_DIR}/AnimatedPlaceholder.client.tsx`;

const SCRIPT = path.resolve('scripts/gates/check-shell-dom-writes.ts');
const WALK_HELPER = path.resolve('scripts/lib/walk.ts');
const roots: string[] = [];

function run(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'shell-dom-writes-'));
  roots.push(root);
  mkdirSync(path.join(root, 'scripts/gates'), { recursive: true });
  mkdirSync(path.join(root, 'scripts/lib'), { recursive: true });
  copyFileSync(WALK_HELPER, path.join(root, 'scripts/lib/walk.ts'));
  const copy = path.join(root, 'scripts/gates/check-shell-dom-writes.ts');
  copyFileSync(SCRIPT, copy);
  mkdirSync(path.join(root, SHELL_DIR), { recursive: true });
  for (const [rel, source] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source);
  }
  return spawnSync('node', [copy], { encoding: 'utf-8' });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-shell-dom-writes', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('passes a shell source that only renders through React', () => {
    const result = run({
      [`${SHELL_DIR}/Clean.tsx`]: 'export const Clean = () => <p>{"x"}</p>;\n',
    });
    expect(result.status).toBe(0);
  });

  it.each([
    ['document.createElement', 'const el = document.createElement("p");\n'],
    ['appendChild', 'host.appendChild(node);\n'],
    ['insertAdjacentHTML', 'host.insertAdjacentHTML("beforeend", html);\n'],
    ['textContent assignment', 'node.textContent = text;\n'],
    ['textContent append', 'node.textContent += text;\n'],
    ['innerHTML assignment', 'node.innerHTML = html;\n'],
  ])('fails a shell source with %s', (_name, line) => {
    const rel = `${SHELL_DIR}/Bad.ts`;
    const result = run({ [rel]: line });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(rel);
  });

  it('does not flag a read of textContent or an equality comparison', () => {
    const result = run({
      [`${SHELL_DIR}/Reads.ts`]:
        'export const same = (n: Element) => n.textContent === "a" && n.innerHTML == "b";\nexport const read = (n: Element) => n.textContent;\n',
    });
    expect(result.status).toBe(0);
  });

  it('ignores test files', () => {
    const result = run({
      [`${SHELL_DIR}/Thing.test.tsx`]: 'document.createElement("p");\n',
    });
    expect(result.status).toBe(0);
  });

  it('allows the placeholder typewriter and fails the same source under any other path', () => {
    const source = 'typed.textContent = text;\n';
    expect(run({ [PLACEHOLDER]: source }).status).toBe(0);
    const other = `${SHELL_DIR}/Other.client.tsx`;
    const result = run({ [other]: source });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(other);
  });

  it('does not scan outside the shell directory', () => {
    const result = run({ 'components/client/Other/Other.ts': 'node.textContent = "x";\n' });
    expect(result.status).toBe(0);
  });
});
