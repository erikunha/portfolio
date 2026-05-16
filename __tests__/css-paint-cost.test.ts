import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const base = readFileSync(path.resolve(__dirname, '../app/css/_base.css'), 'utf-8');
const crt = readFileSync(path.resolve(__dirname, '../app/css/_crt.css'), 'utf-8');
const shell = readFileSync(
  path.resolve(__dirname, '../components/sections/ShellSection.tsx'),
  'utf-8',
);

describe('paint cost CSS', () => {
  it('body rule has no text-shadow', () => {
    const bodyBlock = base.match(/^html,\s*\nbody\s*\{[^}]+\}/m)?.[0];
    expect(bodyBlock).toBeDefined();
    expect(bodyBlock).not.toContain('text-shadow');
  });

  it('body rule has no text-rendering: optimizeLegibility', () => {
    const bodyBlock = base.match(/^html,\s*\nbody\s*\{[^}]+\}/m)?.[0];
    expect(bodyBlock).toBeDefined();
    expect(bodyBlock).not.toContain('optimizeLegibility');
  });

  it('crt-flicker animation duration is at least 3s', () => {
    const flicker = crt.match(/\.crt-flicker\s*\{[^}]+\}/)?.[0] ?? '';
    const dur = flicker.match(/animation:\s*crt-flicker\s+([\d.]+)s/)?.[1];
    expect(Number(dur)).toBeGreaterThanOrEqual(3);
  });

  it('shell postBody does not list ask <question> as a command', () => {
    expect(shell).not.toContain('ask <question>');
  });
});
