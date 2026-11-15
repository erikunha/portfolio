import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import type { ContactField } from '@/content/contact-rules';
import { useContactSubmit } from './useContactSubmit';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const VALID: Record<ContactField, string> = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'A platform engineering opportunity.',
};
const TOO_SHORT = 'short';
const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;

describe('message error derived from the shared message', () => {
  it('is gone in the very render that sees a valid message, with no follow-up render', async () => {
    const seen: Array<{ message: string; error: string | undefined }> = [];
    const hook = renderHook(
      ({ message }) => {
        const result = useContactSubmit({
          copy: contactCopy.en,
          values: { ...VALID, message },
          honeypot: '',
        });
        seen.push({ message, error: result.errors.message });
        return result;
      },
      { initialProps: { message: TOO_SHORT } },
    );
    await act(async () => {
      await hook.result.current.submit(submitEvent());
    });
    expect(hook.result.current.errors.message).toBeDefined();

    seen.length = 0;
    hook.rerender({ message: VALID.message });

    expect(seen).toEqual([{ message: VALID.message, error: undefined }]);
  });
});
