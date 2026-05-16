import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  path.resolve(__dirname, '../components/responsive/MatrixRain.tsx'),
  'utf-8',
);

describe('MatrixRain canvas perf', () => {
  it('ctx.font is not set inside the for-loop column draw block', () => {
    const frameBody = src.slice(src.indexOf('function frame('));
    const forLoopBody = frameBody.match(/for \(let i = 0[\s\S]+?\n    \}/)?.[0] ?? '';
    expect(forLoopBody).not.toContain('ctx!.font =');
  });

  it('resize listener uses a debounced handler', () => {
    expect(src).toMatch(/debounce|setTimeout.*resize|clearTimeout/);
  });
});
