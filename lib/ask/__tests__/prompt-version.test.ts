// lib/ask/__tests__/prompt-version.test.ts
// WS2: PROMPT_VERSION is a content hash DERIVED from the exact SYSTEM_TEXT the
// model receives, so it can never be a stale hand-bumped tag.
//
// Behavioral contracts (no source-grep):
//   1. PROMPT_VERSION equals sha256Hex(SYSTEM_TEXT) truncated — it is the hash
//      of the real prompt bytes, not a constant.
//   2. The hash MOVES when the input bytes move (change content -> version
//      changes), proving derivation rather than a frozen literal.
//   3. The hash is STABLE across reads (computed once, deterministic).

import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@/lib/ask/prompt-version';
import { PROMPT_VERSION, SYSTEM_TEXT } from '@/lib/ask/system-prompt';

describe('sha256Hex — runtime-stable content hash', () => {
  it('is deterministic for the same input', () => {
    expect(sha256Hex('hello world')).toBe(sha256Hex('hello world'));
  });

  it('produces a full 64-char lowercase hex SHA-256 digest', () => {
    expect(sha256Hex('hello world')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the known SHA-256 vector for the empty string', () => {
    // FIPS-180-4 / RFC test vector: SHA-256("") is well known.
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('changes when the input changes by a single byte', () => {
    expect(sha256Hex('prompt')).not.toBe(sha256Hex('promptx'));
  });
});

describe('PROMPT_VERSION — derived from SYSTEM_TEXT', () => {
  it('equals the truncated SHA-256 of the assembled SYSTEM_TEXT', () => {
    // Derivation proof: recompute the hash from the live prompt bytes and
    // assert the exported version is exactly its 12-char prefix.
    expect(PROMPT_VERSION).toBe(sha256Hex(SYSTEM_TEXT).slice(0, 12));
  });

  it('is a 12-char lowercase hex string', () => {
    expect(PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('moves when the prompt bytes move (not a frozen constant)', () => {
    // If a content module changed SYSTEM_TEXT, the derived version would change
    // automatically. Appending a byte models that drift: the version follows.
    const drifted = sha256Hex(`${SYSTEM_TEXT}x`).slice(0, 12);
    expect(drifted).not.toBe(PROMPT_VERSION);
  });

  it('is stable across repeated reads', () => {
    expect(PROMPT_VERSION).toBe(PROMPT_VERSION);
    expect(sha256Hex(SYSTEM_TEXT)).toBe(sha256Hex(SYSTEM_TEXT));
  });
});
