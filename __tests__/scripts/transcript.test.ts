import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  agentsDispatchedSince,
  containsSince,
  lastUserCommitMarker,
  readTranscript,
} from '../../scripts/lib/transcript.mjs';

/**
 * Build a JSONL transcript file from an array of records and return its path.
 * Records may be objects (serialized) or raw strings (written verbatim — used
 * to inject malformed lines).
 */
function writeTranscript(lines: Array<object | string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'transcript-'));
  const path = join(dir, 'session.jsonl');
  const body = lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');
  writeFileSync(path, body);
  return path;
}

/** A Task/Agent dispatch record, shaped like a real transcript line. */
function agentRecord(subagentType: string, timestamp: string) {
  return {
    type: 'assistant',
    timestamp,
    uuid: `uuid-${subagentType}-${timestamp}`,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          name: 'Agent',
          input: { subagent_type: subagentType, description: 'x', prompt: 'y' },
        },
      ],
    },
  };
}

/** A Bash tool_use record running an arbitrary command. */
function bashRecord(command: string, timestamp: string) {
  return {
    type: 'assistant',
    timestamp,
    uuid: `uuid-bash-${timestamp}`,
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name: 'Bash', input: { command } }],
    },
  };
}

describe('readTranscript', () => {
  it('parses well-formed JSONL into records', () => {
    const path = writeTranscript([
      { type: 'user', timestamp: '2026-06-04T00:00:00.000Z' },
      { type: 'assistant', timestamp: '2026-06-04T00:00:01.000Z' },
    ]);
    const records = readTranscript(path);
    expect(records).toHaveLength(2);
    expect(records[0]?.type).toBe('user');
  });

  it('tolerantly skips malformed lines without throwing', () => {
    const path = writeTranscript([
      { type: 'user', timestamp: '2026-06-04T00:00:00.000Z' },
      '{ this is not valid json',
      '',
      { type: 'assistant', timestamp: '2026-06-04T00:00:02.000Z' },
    ]);
    const records = readTranscript(path);
    // Two valid records; the malformed and blank lines are skipped.
    expect(records).toHaveLength(2);
  });

  it('returns an empty array for a missing file (caller decides fail policy)', () => {
    const records = readTranscript('/nonexistent/path/does-not-exist.jsonl');
    expect(records).toEqual([]);
  });
});

describe('lastUserCommitMarker', () => {
  it('returns the index of the most recent commit record (Bash git commit)', () => {
    const records = [
      agentRecord('security-auditor', '2026-06-04T00:00:00.000Z'),
      bashRecord('git commit -m "feat(x): thing"', '2026-06-04T00:00:01.000Z'),
      agentRecord('performance-engineer', '2026-06-04T00:00:02.000Z'),
    ];
    expect(lastUserCommitMarker(records)).toBe(1);
  });

  it('detects a commit dispatched via the commit-commands:commit Skill', () => {
    const records = [
      {
        type: 'assistant',
        timestamp: '2026-06-04T00:00:00.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'Skill', input: { skill: 'commit-commands:commit' } },
          ],
        },
      },
      agentRecord('security-auditor', '2026-06-04T00:00:01.000Z'),
    ];
    expect(lastUserCommitMarker(records)).toBe(0);
  });

  it('returns -1 when no commit is present (whole transcript is the cycle)', () => {
    const records = [agentRecord('security-auditor', '2026-06-04T00:00:00.000Z')];
    expect(lastUserCommitMarker(records)).toBe(-1);
  });
});

describe('agentsDispatchedSince', () => {
  it('collects subagent_type values from Agent dispatch records', () => {
    const records = [
      agentRecord('security-auditor', '2026-06-04T00:00:00.000Z'),
      agentRecord('performance-engineer', '2026-06-04T00:00:01.000Z'),
    ];
    const set = agentsDispatchedSince(records, -1);
    expect(set).toContain('security-auditor');
    expect(set).toContain('performance-engineer');
  });

  it('honors the boundary index — ignores dispatches at or before it', () => {
    const records = [
      agentRecord('security-auditor', '2026-06-04T00:00:00.000Z'), // index 0, pre-commit
      bashRecord('git commit -m "x"', '2026-06-04T00:00:01.000Z'), // index 1 = boundary
      agentRecord('performance-engineer', '2026-06-04T00:00:02.000Z'), // index 2, post-commit
    ];
    const set = agentsDispatchedSince(records, 1);
    // Only the post-commit dispatch counts.
    expect(set).toContain('performance-engineer');
    expect(set).not.toContain('security-auditor');
  });

  it('extracts the real five-agent battery from a captured-shape fixture', () => {
    const battery = [
      'pr-review-toolkit:review-pr',
      'accessibility-tester',
      'security-auditor',
      'performance-engineer',
      'dependency-manager',
    ];
    const records = battery.map((a, i) => agentRecord(a, `2026-06-04T00:00:0${i}.000Z`));
    const set = agentsDispatchedSince(records, -1);
    for (const a of battery) expect(set).toContain(a);
  });
});

describe('containsSince', () => {
  it('finds a needle string in record content after the boundary', () => {
    const records = [
      agentRecord('architect-reviewer', '2026-06-04T00:00:00.000Z'),
      {
        type: 'user',
        timestamp: '2026-06-04T00:00:01.000Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              content: [{ type: 'text', text: 'report...\nGATE_RESULT: PASS\n' }],
            },
          ],
        },
      },
    ];
    expect(containsSince(records, 'GATE_RESULT: PASS', -1)).toBe(true);
  });

  it('returns false when the needle only appears at or before the boundary', () => {
    const records = [
      {
        type: 'user',
        timestamp: '2026-06-04T00:00:00.000Z',
        message: { role: 'user', content: 'GATE_RESULT: PASS' },
      },
      agentRecord('security-auditor', '2026-06-04T00:00:01.000Z'),
    ];
    // Boundary at index 0 means "strictly after index 0".
    expect(containsSince(records, 'GATE_RESULT: PASS', 0)).toBe(false);
  });
});
