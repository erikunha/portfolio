import { describe, expect, it } from 'vitest';
import { errorFingerprint } from '@/lib/error-fingerprint';

const FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;
const STACK = [
  'TypeError: x is undefined',
  '    at render (https://erikunha.dev/_next/static/chunks/app-1a2b3c.js:10:20)',
  '    at update (https://erikunha.dev/_next/static/chunks/app-1a2b3c.js:30:40)',
  '    at flush (https://erikunha.dev/_next/static/chunks/app-1a2b3c.js:50:60)',
  '    at tail (https://erikunha.dev/_next/static/chunks/app-1a2b3c.js:70:80)',
].join('\n');

describe('errorFingerprint', () => {
  it('returns a fixed-length hex string', () => {
    expect(errorFingerprint({ message: 'boom' })).toMatch(FINGERPRINT_PATTERN);
  });

  it('is the same for the same message and stack', () => {
    expect(errorFingerprint({ message: 'boom', stack: STACK })).toBe(
      errorFingerprint({ message: 'boom', stack: STACK }),
    );
  });

  it('differs for a different message', () => {
    expect(errorFingerprint({ message: 'boom' })).not.toBe(errorFingerprint({ message: 'bang' }));
  });

  it('ignores digits and ids that vary per occurrence in the message', () => {
    const first = errorFingerprint({
      message: 'Failed to load item 42 for 3f2a9c1e-1111-4222-8333-444455556666',
    });
    const second = errorFingerprint({
      message: 'Failed to load item 977 for 0a0b0c0d-9999-4888-8777-666655554444',
    });
    expect(first).toBe(second);
  });

  it('ignores line and column numbers and the host in stack frames', () => {
    const moved = STACK.replaceAll(':10:20', ':11:21').replace(
      'https://erikunha.dev',
      'https://www.erikunha.dev',
    );
    expect(errorFingerprint({ message: 'm', stack: moved })).toBe(
      errorFingerprint({ message: 'm', stack: STACK }),
    );
  });

  it('differs when the top frames differ', () => {
    const other = STACK.replace('at render', 'at paint');
    expect(errorFingerprint({ message: 'm', stack: other })).not.toBe(
      errorFingerprint({ message: 'm', stack: STACK }),
    );
  });

  it('reads only the first frames of the stack', () => {
    const deeper = STACK.replace('at tail', 'at somewhere-else');
    expect(errorFingerprint({ message: 'm', stack: deeper })).toBe(
      errorFingerprint({ message: 'm', stack: STACK }),
    );
  });

  it('reads Safari and Firefox style frames', () => {
    const stack = 'render@https://erikunha.dev/a.js:1:2\nupdate@https://erikunha.dev/a.js:3:4';
    const shifted = 'render@https://erikunha.dev/a.js:9:9\nupdate@https://erikunha.dev/a.js:8:8';
    expect(errorFingerprint({ message: 'm', stack })).toBe(
      errorFingerprint({ message: 'm', stack: shifted }),
    );
  });

  it('separates a report with a stack from one without', () => {
    expect(errorFingerprint({ message: 'm', stack: STACK })).not.toBe(
      errorFingerprint({ message: 'm' }),
    );
  });
});
