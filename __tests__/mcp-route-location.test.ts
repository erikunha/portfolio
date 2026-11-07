import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = path.resolve(__dirname, '../app/api');

describe('MCP route location', () => {
  it('serves MCP from the fixed /api/mcp route and has no catch-all dynamic segment under /api', () => {
    expect(existsSync(path.join(API_DIR, 'mcp/route.ts'))).toBe(true);
    expect(
      existsSync(path.join(API_DIR, '[transport]')),
      'a dynamic segment would answer MCP at every /api/<anything> path no other route claims; docs that name it are stale',
    ).toBe(false);
  });
});
