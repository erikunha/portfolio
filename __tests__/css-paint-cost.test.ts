// carry behavioral-test-allow tags.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

vi.mock('@/content/shell-commands', () => ({
  default: [],
}));

describe('shell command hint', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('does not list "ask <question>" as a command in the rendered shell', async () => {
    const { InteractiveShell } = await import('@/components/client/InteractiveShell');

    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    const hint = container.querySelector('[data-testid="shell-commands"]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent ?? '').not.toContain('ask <question>');
  });
});

describe('paint cost CSS (shipped build assets)', () => {
  it('the body rule carries no text-shadow and no optimizeLegibility', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate paint cost
    const base = readFileSync(path.resolve(__dirname, '../app/css/base.css'), 'utf-8');
    const bodyBlock = base.match(/^\s*html,\s*\n\s*body\s*\{[^}]+\}/m)?.[0];
    expect(bodyBlock).toBeDefined();
    expect(bodyBlock).not.toContain('text-shadow');
    expect(bodyBlock).not.toContain('optimizeLegibility');
  });

  it('the crt-flicker animation runs at >= 3s (cheap, not jittery)', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate @keyframes timing; crt.css is authoritative after the components.css split (2026-05-31)
    const crt = readFileSync(path.resolve(__dirname, '../app/css/crt.css'), 'utf-8');
    const flicker = crt.match(/\.crt-flicker\s*\{[^}]+\}/)?.[0] ?? '';
    const dur = flicker.match(/animation:\s*crt-flicker\s+([\d.]+)s/)?.[1];
    expect(Number(dur)).toBeGreaterThanOrEqual(3);
  });
});
