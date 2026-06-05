// scripts/lib/transcript.mjs
//
// Shared transcript-inspection primitives for the WS4 gate verifiers
// (scripts/review-stamp.ts, .claude/hooks/api-security-push-guard.sh via node,
// .claude/hooks/architect-gate.sh via node).
//
// Claude Code session transcripts are JSONL — one JSON object per line — at
// ~/.claude/projects/<project-slug>/<session-uuid>.jsonl. The load-bearing
// signal is the STRUCTURED `subagent_type` key on Task/Agent dispatch records,
// not a free-text grep of model prose. Captured real record shapes (verified in
// this repo's live transcripts, 2026-06-04):
//
//   Task/Agent dispatch (assistant turn):
//     { type: "assistant", timestamp: "<ISO>", uuid: "<id>",
//       message: { role: "assistant", content: [
//         { type: "tool_use", name: "Agent",
//           input: { subagent_type: "security-auditor", description, prompt } } ] } }
//     Observed subagent_type values: "pr-review-toolkit:review-pr",
//     "accessibility-tester", "security-auditor", "performance-engineer",
//     "dependency-manager", "architect-reviewer", "Explore", "general-purpose".
//
//   Skill invocation (assistant turn):
//     { ..., message: { content: [
//       { type: "tool_use", name: "Skill", input: { skill: "commit-commands:commit", args } } ] } }
//     The skill identifier field is `skill` (NOT `command`).
//
// These functions are pure (path-in, value-out) so the decision logic is
// unit-testable without a live session.

import { readFileSync } from 'node:fs';

/**
 * Read a JSONL transcript into an array of parsed records.
 * Tolerant: blank lines and malformed JSON are skipped, never thrown. A missing
 * or unreadable file returns [] — the CALLER decides the fail policy
 * (review-stamp fails closed on []; the API guard fails closed on a present
 * marker + []). This keeps the helper policy-free.
 *
 * @param {string} transcriptPath
 * @returns {Array<Record<string, unknown>>}
 */
export function readTranscript(transcriptPath) {
  let raw;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch {
    return [];
  }
  const records = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // Tolerant: skip malformed lines (partial writes, truncation).
    }
  }
  return records;
}

/**
 * Extract the tool_use content items from a record's message, defensively.
 * @param {Record<string, unknown>} record
 * @returns {Array<Record<string, unknown>>}
 */
function toolUses(record) {
  const message = record?.message;
  if (!message || typeof message !== 'object') return [];
  const content = message.content;
  if (!Array.isArray(content)) return [];
  return content.filter((item) => item && typeof item === 'object' && item.type === 'tool_use');
}

/**
 * Index of the most recent record that evidences a git commit, or -1 if none.
 * The post-commit husky hook clears `.review-passed` on every commit, so "this
 * push's review cycle" means "events strictly after the last commit." We detect
 * a commit two ways:
 *   - a Bash tool_use whose command runs `git commit`
 *   - a Skill tool_use for `commit-commands:commit`
 * Returns -1 when no commit appears, meaning the whole transcript is the cycle
 * (correct for a fresh branch with no prior commit this session).
 *
 * @param {Array<Record<string, unknown>>} records
 * @returns {number}
 */
export function lastUserCommitMarker(records) {
  let marker = -1;
  records.forEach((record, index) => {
    for (const tu of toolUses(record)) {
      const name = tu.name;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (name === 'Bash' && typeof input.command === 'string') {
        if (/\bgit\s+commit\b/.test(input.command)) marker = index;
      }
      if (name === 'Skill' && input.skill === 'commit-commands:commit') {
        marker = index;
      }
    }
  });
  return marker;
}

/**
 * Set of `subagent_type` strings dispatched STRICTLY AFTER the boundary index.
 * Pass boundary = -1 to scope the whole transcript; pass the
 * lastUserCommitMarker to scope "since the last commit."
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {number} boundaryIndex
 * @returns {string[]} unique subagent_type values (insertion order)
 */
export function agentsDispatchedSince(records, boundaryIndex) {
  const seen = new Set();
  records.forEach((record, index) => {
    if (index <= boundaryIndex) return;
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (typeof input.subagent_type === 'string') seen.add(input.subagent_type);
    }
  });
  return [...seen];
}

/**
 * Index of the LAST Agent dispatch of `subagentType`, or -1 if none. Used to
 * scope a follow-on check (e.g. a GATE_RESULT: PASS tool_result) to records
 * AFTER the dispatch, so an unrelated tool_result carrying the sentinel before
 * the architect even ran cannot satisfy the gate.
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {string} subagentType
 * @returns {number}
 */
export function lastDispatchIndex(records, subagentType) {
  let idx = -1;
  records.forEach((record, index) => {
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (input.subagent_type === subagentType) idx = index;
    }
  });
  return idx;
}

/**
 * Whether `needle` appears anywhere in the serialized content of any record
 * STRICTLY AFTER the boundary index. Used to detect the architect-reviewer
 * `GATE_RESULT: PASS` sentinel, which lands in a nested tool_result text block
 * (not a structured field), so a serialized substring scan is the robust check.
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {string} needle
 * @param {number} boundaryIndex
 * @returns {boolean}
 */
export function containsSince(records, needle, boundaryIndex) {
  for (let index = 0; index < records.length; index++) {
    if (index <= boundaryIndex) continue;
    if (JSON.stringify(records[index]).includes(needle)) return true;
  }
  return false;
}

/**
 * Whether `needle` appears inside a tool_result content block (the shape a
 * dispatched subagent's returned report takes) STRICTLY AFTER the boundary.
 * Tighter than `containsSince`: it ignores the string appearing in the
 * operator's own prose / instruction quotes, so an architect-reviewer that
 * returned FAIL cannot be spoofed into a PASS by the literal `GATE_RESULT: PASS`
 * showing up elsewhere in the conversation. Scans `message.content[]` items
 * whose `type` is `tool_result` (the shape a subagent's returned report takes).
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {string} needle
 * @param {number} boundaryIndex
 * @returns {boolean}
 */
export function containsInToolResultSince(records, needle, boundaryIndex) {
  for (let index = 0; index < records.length; index++) {
    if (index <= boundaryIndex) continue;
    const record = records[index];
    const message =
      record && typeof record === 'object' ? /** @type {any} */ (record).message : undefined;
    const content = message && typeof message === 'object' ? message.content : undefined;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item && typeof item === 'object' && item.type === 'tool_result') {
        if (JSON.stringify(item).includes(needle)) return true;
      }
    }
  }
  return false;
}

/**
 * Whether an Agent dispatch of `subagentType` occurs in a record whose ISO
 * `timestamp` is strictly greater than `afterIso`. Used to enforce ORDERING:
 * a security-auditor dispatch only counts if it happened AFTER the most recent
 * API-edit marker entry (otherwise a stale pre-edit audit would falsely clear
 * the marker). Records without a parseable timestamp are ignored (conservative:
 * an unstamped dispatch cannot prove it ran after the edit).
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {string} subagentType
 * @param {string} afterIso ISO-8601 timestamp; the dispatch must be strictly after it
 * @returns {boolean}
 */
export function agentDispatchedAfter(records, subagentType, afterIso) {
  const afterMs = Date.parse(afterIso);
  if (Number.isNaN(afterMs)) return false;
  for (const record of records) {
    const ts = record && typeof record === 'object' ? /** @type {any} */ (record).timestamp : null;
    const tsMs = typeof ts === 'string' ? Date.parse(ts) : Number.NaN;
    if (Number.isNaN(tsMs) || tsMs <= afterMs) continue;
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (input.subagent_type === subagentType) return true;
    }
  }
  return false;
}
