// __tests__/InteractiveShell.streaming.test.ts
// Verifies the streaming path in InteractiveShell uses getReader() for progressive rendering,
// NOT res.text() which would buffer the entire response before displaying.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../components/client/InteractiveShell.tsx'),
  'utf-8',
);

describe('InteractiveShell streaming implementation', () => {
  it('does NOT use res.text() in the ask branch (buffered read)', () => {
    // If this fails, someone reverted streaming back to the buffered approach.
    // res.text() loads the entire response before rendering — bad for streaming UX.
    expect(SOURCE).not.toMatch(/await\s+res\.text\(\)/);
  });

  it('uses res.body.getReader() for progressive streaming', () => {
    // Literal substring match — avoids regex escaping edge cases.
    expect(SOURCE).toContain('getReader()');
  });

  it('uses TextDecoder for chunk decoding', () => {
    expect(SOURCE).toMatch(/new\s+TextDecoder\(\)/);
  });

  it('uses stable line ids from a ref-based counter (not index-based keys)', () => {
    // lineIdRef is a useRef counter; nextId() increments it each call.
    // This pattern avoids module-level mutation while keeping IDs stable across renders.
    expect(SOURCE).toMatch(/lineIdRef/);
    expect(SOURCE).toMatch(/nextId\(\)/);
  });

  it('keys history items by id not array index', () => {
    // key={l.id} pattern must be present, key={i} must not.
    expect(SOURCE).toMatch(/key=\{l\.id\}/);
    expect(SOURCE).not.toMatch(/key=\{i\}/);
  });
});
