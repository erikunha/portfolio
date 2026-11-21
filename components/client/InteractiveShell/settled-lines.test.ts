import { describe, expect, it } from 'vitest';
import { fillShellState, ShellLineKind, shellStates, shellUi } from '@/content/shell-ui';
import { HTTP_STATUS } from '@/lib/http-status';
import { failureForResponse, settledLines } from './settled-lines';

const ui = shellUi.en;
const states = shellStates.en;
const FIRST_ID = 100;

function counter() {
  let next = FIRST_ID;
  return () => next++;
}

const base = {
  text: '',
  error: false,
  detail: {},
  requestId: null,
  logged: false,
  ui,
};

describe('settledLines', () => {
  it('emits the answer alone for a clean stream', () => {
    expect(settledLines({ ...base, text: 'hello', nextId: counter() })).toEqual([
      { id: 100, kind: ShellLineKind.Output, text: 'hello', ai: true },
    ]);
  });

  it('emits the empty copy when there is neither text nor message', () => {
    expect(settledLines({ ...base, nextId: counter() })).toEqual([
      { id: 100, kind: ShellLineKind.Output, text: ui.empty },
    ]);
  });

  it('emits the answer then an info line for a stop with partial text', () => {
    expect(
      settledLines({ ...base, text: 'part', message: ui.stoppedPartial, nextId: counter() }),
    ).toEqual([
      { id: 100, kind: ShellLineKind.Output, text: 'part', ai: true },
      { id: 101, kind: ShellLineKind.Info, text: ui.stoppedPartial },
    ]);
  });

  it('emits only the info line for a stop before any text', () => {
    expect(settledLines({ ...base, message: ui.stoppedBefore, nextId: counter() })).toEqual([
      { id: 100, kind: ShellLineKind.Info, text: ui.stoppedBefore },
    ]);
  });

  it('prefixes an error without a detail prefix with the error prefix', () => {
    expect(
      settledLines({ ...base, text: 'x', message: 'boom', error: true, nextId: counter() }),
    ).toEqual([
      { id: 100, kind: ShellLineKind.Output, text: 'x', ai: true },
      { id: 101, kind: ShellLineKind.Error, text: `${ui.errorPrefix} boom` },
    ]);
  });

  it('keeps the message bare and carries prefix, retry and hint from the detail', () => {
    expect(
      settledLines({
        ...base,
        message: 'down',
        error: true,
        detail: { prefix: 'stderr 500', retry: 'ask me', hint: true },
        nextId: counter(),
      }),
    ).toEqual([
      { id: 100, kind: ShellLineKind.Error, text: 'down', prefix: 'stderr 500', retry: 'ask me' },
      { id: 101, kind: ShellLineKind.Hint, text: '' },
    ]);
  });

  it('emits a rate limit line when the detail has retryAfter, without prefix or hint', () => {
    expect(
      settledLines({
        ...base,
        message: 'slow',
        error: true,
        detail: { retryAfter: 30, hint: true },
        nextId: counter(),
      }),
    ).toEqual([{ id: 100, kind: ShellLineKind.RateLimit, text: 'slow', retryAfter: 30 }]);
  });

  it('appends the reference only when the request was logged and has an id', () => {
    const logged = settledLines({
      ...base,
      text: 'a',
      requestId: 'r1',
      logged: true,
      nextId: counter(),
    });
    expect(logged.at(-1)).toEqual({ id: 101, kind: ShellLineKind.Reference, text: 'r1' });
    expect(settledLines({ ...base, text: 'a', requestId: 'r1', nextId: counter() })).toHaveLength(
      1,
    );
    expect(settledLines({ ...base, text: 'a', logged: true, nextId: counter() })).toHaveLength(1);
  });

  it('draws ids in line order and only for the lines it emits', () => {
    const nextId = counter();
    settledLines({ ...base, message: 'm', error: true, detail: { hint: true }, nextId });
    expect(nextId()).toBe(FIRST_ID + 2);
  });
});

describe('failureForResponse', () => {
  const response = (status: number, errorDetail = '', retryAfterHeader: string | null = null) => ({
    status,
    errorDetail,
    retryAfterHeader,
    states,
    ui,
  });

  it('maps a 429 with Retry-After to the slow-down copy and a retryAfter detail', () => {
    const left = `30 ${states.secondsUnit}`;
    expect(failureForResponse(response(HTTP_STATUS.tooManyRequests, 'ignored', '30'))).toEqual({
      message: `${fillShellState(states.slowDown, { left })}. ${states.localCommands}`,
      detail: { retryAfter: 30 },
    });
  });

  it('formats a long Retry-After in minutes', () => {
    const result = failureForResponse(response(HTTP_STATUS.tooManyRequests, '', '120'));
    expect(result.message).toContain(`2 ${states.minutesUnit}`);
    expect(result.detail).toEqual({ retryAfter: 120 });
  });

  it.each([
    ['absent', null],
    ['unparseable', 'soon'],
    ['zero', '0'],
  ])('treats a 429 with %s Retry-After as a plain error with the local hint', (_n, header) => {
    expect(failureForResponse(response(HTTP_STATUS.tooManyRequests, 'busy', header))).toEqual({
      message: `busy. ${ui.localAvailable}`,
      detail: { prefix: `${states.stderrCommand} 429`, hint: false },
    });
  });

  it('ignores Retry-After on a non-429 status', () => {
    expect(failureForResponse(response(HTTP_STATUS.badRequest, 'bad', '30'))).toEqual({
      message: 'bad',
      detail: { prefix: `${states.stderrCommand} 400`, hint: false },
    });
  });

  it('uses the too-large copy for 413 without a body error', () => {
    expect(failureForResponse(response(HTTP_STATUS.payloadTooLarge)).message).toBe(
      ui.requestTooLarge,
    );
  });

  it('prefers the body error over the status copy', () => {
    expect(failureForResponse(response(HTTP_STATUS.payloadTooLarge, 'custom')).message).toBe(
      'custom',
    );
  });

  it.each([
    [HTTP_STATUS.internalServerError, true],
    [HTTP_STATUS.badGateway, true],
    [HTTP_STATUS.forbidden, false],
  ])('falls back to the server error copy for %i, hint %s', (status, hint) => {
    expect(failureForResponse(response(status))).toEqual({
      message: ui.serverError,
      detail: { prefix: `${states.stderrCommand} ${status}`, hint },
    });
  });
});
