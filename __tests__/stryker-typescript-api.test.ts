import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const STRYKER_REQUIRED_TS_API = 'parseConfigFileTextToJson';

describe('stryker typescript JS-API compatibility', () => {
  it('resolves a typescript package exposing the config-parsing API stryker core calls', () => {
    const api = (ts as unknown as Record<string, unknown>)[STRYKER_REQUIRED_TS_API];

    expect(typeof api).toBe('function');
  });
});
