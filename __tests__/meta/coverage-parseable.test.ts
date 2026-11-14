import { globSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../vitest.config';

const COMPILED_DOCUMENTS = /\.mdx?$/;

describe('coverage never selects a compiled document page', () => {
  it('leaves MDX and Markdown pages out, which the coverage parser rejects as JavaScript', () => {
    const coverage = config.test?.coverage;
    const include = coverage && 'include' in coverage ? (coverage.include ?? []) : [];
    const exclude = coverage && 'exclude' in coverage ? (coverage.exclude ?? []) : [];
    expect(include.length).toBeGreaterThan(0);
    const selected = include
      .flatMap((pattern) => globSync(pattern, { exclude: ['**/node_modules/**'] }))
      .filter((file) => !exclude.some((pattern) => matchesGlob(file, pattern)));
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.filter((file) => COMPILED_DOCUMENTS.test(file))).toEqual([]);
  });
});
