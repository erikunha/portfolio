import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const STRYKER_REQUIRED_TS_API = 'parseConfigFileTextToJson';
const STRYKER_CORE = '@stryker-mutator/core';
const TYPESCRIPT = 'typescript';

describe('stryker typescript JS-API compatibility', () => {
  it('resolves a typescript exposing the config-parsing API from stryker core own context', () => {
    const requireFromRoot = createRequire(import.meta.url);
    const requireFromStryker = createRequire(requireFromRoot.resolve(STRYKER_CORE));

    const ts = requireFromStryker(TYPESCRIPT) as Record<string, unknown>;

    expect(typeof ts[STRYKER_REQUIRED_TS_API]).toBe('function');
  });
});
