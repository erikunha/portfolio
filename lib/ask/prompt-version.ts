// lib/ask/prompt-version.ts
//
// Single hashing source for the derived PROMPT_VERSION. Imported by
// system-prompt.ts (which exports the version) AND, transitively, by the route
// and the eval harness — so all three agree on the exact digest for a given
// prompt body and the version can never drift from the prompt bytes.
//
// Runtime parity: the live route runs on the Node runtime (the /api/ask handler
// pins no `export const runtime = 'edge'`), and the eval harness runs under tsx
// on Node. `node:crypto` createHash is a SINGLE synchronous code path on both,
// which is what lets PROMPT_VERSION be computed once at module load without the
// async-at-module-load hazard that `crypto.subtle.digest` (Promise-returning)
// would introduce. No new dependency: hashing uses the platform crypto.

// node:crypto must never reach a client/edge bundle; server-only makes Next.js
// fail fast if a client component imports this helper (directly or transitively).
// The eval harness + unit tests alias server-only to an empty mock, so the
// Node/tsx paths that legitimately import it are unaffected.
import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Synchronous SHA-256 of a UTF-8 string, returned as lowercase hex.
 *
 * Pure and deterministic: the same input always yields the same 64-char digest
 * on every runtime that exposes `node:crypto`. Used to derive PROMPT_VERSION
 * from the assembled SYSTEM_TEXT so the version is a content hash of the exact
 * bytes the model receives, never a hand-bumped tag.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
