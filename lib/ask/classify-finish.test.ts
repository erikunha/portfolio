import { describe, expect, it } from 'vitest';
import {
  type ClientEnding,
  classifyFinish,
  type FinishObservation,
  statusAfterClose,
} from '@/lib/ask/classify-finish';
import type { AskInteractionStatus } from '@/lib/ask/types';

type EndRow = {
  name: string;
  upstreamFailed: boolean;
  finishReason: unknown;
  status: AskInteractionStatus;
  failureReason: string | null;
  truncated: boolean;
  ending: ClientEnding;
};

const END_ROWS: EndRow[] = [
  {
    name: 'upstream failure ends errored with the interrupted message',
    upstreamFailed: true,
    finishReason: 'stop',
    status: 'errored',
    failureReason: 'upstream',
    truncated: false,
    ending: { kind: 'interrupted' },
  },
  {
    name: 'upstream failure wins over a length finish',
    upstreamFailed: true,
    finishReason: 'length',
    status: 'errored',
    failureReason: 'upstream',
    truncated: false,
    ending: { kind: 'interrupted' },
  },
  {
    name: 'a length finish stays completed, is marked truncated and appends the notice',
    upstreamFailed: false,
    finishReason: 'length',
    status: 'completed',
    failureReason: null,
    truncated: true,
    ending: { kind: 'truncation' },
  },
  {
    name: 'a content-filter finish is refused with the refusal message',
    upstreamFailed: false,
    finishReason: 'content-filter',
    status: 'refused',
    failureReason: null,
    truncated: false,
    ending: { kind: 'refusal' },
  },
  {
    name: 'an interrupted finish is errored with the interrupted reason',
    upstreamFailed: false,
    finishReason: 'interrupted',
    status: 'errored',
    failureReason: 'interrupted',
    truncated: false,
    ending: { kind: 'interrupted' },
  },
  {
    name: 'a stop finish is a plain completion',
    upstreamFailed: false,
    finishReason: 'stop',
    status: 'completed',
    failureReason: null,
    truncated: false,
    ending: { kind: 'none' },
  },
  {
    name: 'an unresolved finish reason is a plain completion',
    upstreamFailed: false,
    finishReason: undefined,
    status: 'completed',
    failureReason: null,
    truncated: false,
    ending: { kind: 'none' },
  },
  {
    name: 'an unknown finish reason is a plain completion',
    upstreamFailed: false,
    finishReason: 'tool-calls',
    status: 'completed',
    failureReason: null,
    truncated: false,
    ending: { kind: 'none' },
  },
];

describe('classifyFinish at the end of the text stream', () => {
  it.each(END_ROWS)('$name', (row) => {
    expect(
      classifyFinish({
        source: 'stream-end',
        upstreamFailed: row.upstreamFailed,
        finishReason: row.finishReason,
      }),
    ).toEqual({
      status: row.status,
      failureReason: row.failureReason,
      truncated: row.truncated,
      ending: row.ending,
    });
  });
});

describe('classifyFinish on a guard abort', () => {
  it.each(['leak', 'length'] as const)('a %s abort is errored by the output guard', (reason) => {
    expect(classifyFinish({ source: 'guard-abort', reason })).toEqual({
      status: 'errored',
      failureReason: 'output-guard',
      truncated: false,
      ending: { kind: 'guard-abort', reason },
    });
  });
});

describe('classifyFinish on a thrown stream error', () => {
  const ROWS: Array<{ name: string; midStreamTimeout: boolean; failureReason: string }> = [
    {
      name: 'the mid-stream watchdog',
      midStreamTimeout: true,
      failureReason: 'mid-stream-timeout',
    },
    { name: 'any other error', midStreamTimeout: false, failureReason: 'stream-error' },
  ];
  it.each(ROWS)('$name is errored with $failureReason', ({ midStreamTimeout, failureReason }) => {
    const observation: FinishObservation = { source: 'stream-error', midStreamTimeout };
    expect(classifyFinish(observation)).toEqual({
      status: 'errored',
      failureReason,
      truncated: false,
      ending: { kind: 'interrupted' },
    });
  });
});

describe('statusAfterClose', () => {
  const ROWS: Array<{
    status: AskInteractionStatus;
    clientGone: boolean;
    expected: AskInteractionStatus;
  }> = [
    { status: 'completed', clientGone: true, expected: 'aborted' },
    { status: 'completed', clientGone: false, expected: 'completed' },
    { status: 'errored', clientGone: true, expected: 'errored' },
    { status: 'refused', clientGone: true, expected: 'refused' },
    { status: 'aborted', clientGone: true, expected: 'aborted' },
  ];
  it.each(ROWS)('$status with clientGone $clientGone ends $expected', (row) => {
    expect(statusAfterClose(row.status, row.clientGone)).toBe(row.expected);
  });
});
