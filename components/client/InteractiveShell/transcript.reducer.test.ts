import { describe, expect, it } from 'vitest';
import { SHELL_LIMITS, ShellLineKind } from '@/content/shell-ui';
import { type Line, TranscriptAction, transcriptReducer } from './transcript';

const output = (id: number, text = `line ${id}`): Line => ({
  id,
  kind: ShellLineKind.Output,
  text,
});
const reference = (id: number): Line => ({ id, kind: ShellLineKind.Reference, text: `ref ${id}` });
const loading = (id: number): Line => ({ id, kind: ShellLineKind.Loading, text: '' });

function frozen(lines: Line[]): Line[] {
  for (const line of lines) Object.freeze(line);
  return Object.freeze(lines) as Line[];
}

function many(count: number, startId = 0): Line[] {
  return Array.from({ length: count }, (_, index) => output(startId + index));
}

describe('transcriptReducer', () => {
  it('appends lines after the existing ones', () => {
    const state = frozen([output(1), output(2)]);
    expect(
      transcriptReducer(state, { type: TranscriptAction.Append, lines: [output(3), output(4)] }),
    ).toEqual([output(1), output(2), output(3), output(4)]);
  });

  it('appends nothing when no lines are given', () => {
    const state = frozen([output(1)]);
    expect(transcriptReducer(state, { type: TranscriptAction.Append, lines: [] })).toEqual(state);
  });

  it('drops the oldest lines when an append passes the cap', () => {
    const state = frozen(many(SHELL_LIMITS.logEntries));
    const result = transcriptReducer(state, {
      type: TranscriptAction.Append,
      lines: [output(1000), output(1001)],
    });
    expect(result).toHaveLength(SHELL_LIMITS.logEntries);
    expect(result.slice(0, 1)).toEqual([output(2)]);
    expect(result.slice(-2)).toEqual([output(1000), output(1001)]);
  });

  it('removes only the line with the given id', () => {
    const state = frozen([output(1), loading(2), output(3)]);
    expect(transcriptReducer(state, { type: TranscriptAction.Remove, id: 2 })).toEqual([
      output(1),
      output(3),
    ]);
  });

  it('leaves the transcript equal when the id is absent', () => {
    const state = frozen([output(1), output(2)]);
    expect(transcriptReducer(state, { type: TranscriptAction.Remove, id: 99 })).toEqual(state);
  });

  describe('settle', () => {
    const state = frozen([output(1), reference(2), loading(3), reference(4)]);

    it('removes the loading line and appends the settled lines, keeping references', () => {
      expect(
        transcriptReducer(state, {
          type: TranscriptAction.Settle,
          loadingId: 3,
          dropReferences: false,
          lines: [output(5)],
        }),
      ).toEqual([output(1), reference(2), reference(4), output(5)]);
    });

    it('also drops reference lines when the request was logged', () => {
      expect(
        transcriptReducer(state, {
          type: TranscriptAction.Settle,
          loadingId: 3,
          dropReferences: true,
          lines: [output(5), reference(6)],
        }),
      ).toEqual([output(1), output(5), reference(6)]);
    });

    it('filters before it appends, so the settled lines survive their own kind', () => {
      const result = transcriptReducer(frozen([loading(1)]), {
        type: TranscriptAction.Settle,
        loadingId: 1,
        dropReferences: true,
        lines: [reference(2)],
      });
      expect(result).toEqual([reference(2)]);
    });

    it('bounds the result at the cap', () => {
      const full = frozen([...many(SHELL_LIMITS.logEntries - 1), loading(500)]);
      const result = transcriptReducer(full, {
        type: TranscriptAction.Settle,
        loadingId: 500,
        dropReferences: false,
        lines: [output(901), output(902), output(903)],
      });
      expect(result).toHaveLength(SHELL_LIMITS.logEntries);
      expect(result.slice(-3)).toEqual([output(901), output(902), output(903)]);
    });
  });

  describe('forget conversation', () => {
    it('drops every reference line then appends the notices', () => {
      const state = frozen([output(1), reference(2), output(3), reference(4)]);
      expect(
        transcriptReducer(state, {
          type: TranscriptAction.ForgetConversation,
          lines: [output(5), output(6)],
        }),
      ).toEqual([output(1), output(3), output(5), output(6)]);
    });

    it('bounds the result at the cap', () => {
      const state = frozen(many(SHELL_LIMITS.logEntries));
      const result = transcriptReducer(state, {
        type: TranscriptAction.ForgetConversation,
        lines: [output(700)],
      });
      expect(result).toHaveLength(SHELL_LIMITS.logEntries);
      expect(result.at(-1)).toEqual(output(700));
    });
  });

  it('clear replaces the whole transcript', () => {
    const state = frozen([output(1), reference(2)]);
    const fresh = [output(9)];
    expect(transcriptReducer(state, { type: TranscriptAction.Clear, lines: fresh })).toEqual(fresh);
  });

  const everyAction: [string, TranscriptAction][] = [
    ['append', { type: TranscriptAction.Append, lines: [output(9)] }],
    ['remove', { type: TranscriptAction.Remove, id: 1 }],
    [
      'settle',
      { type: TranscriptAction.Settle, loadingId: 1, dropReferences: true, lines: [output(9)] },
    ],
    ['forget conversation', { type: TranscriptAction.ForgetConversation, lines: [output(9)] }],
    ['clear', { type: TranscriptAction.Clear, lines: [output(9)] }],
  ];

  it.each(everyAction)('does not mutate the previous state on %s', (_name, action) => {
    const state = frozen([output(1), reference(2), loading(3)]);
    const snapshot = structuredClone(state);
    const result = transcriptReducer(state, action);
    expect(state).toEqual(snapshot);
    expect(result).not.toBe(state);
  });
});
