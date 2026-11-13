import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/(en)/[...missing]/not-found';

const pathnameMock = vi.fn<() => string | null>();

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathnameMock(),
}));

const COMMAND_SELECTOR = '.cmd-line';
const REPLACEMENT_PATTERN_PATHS = ["/a$'b", '/a$&b', '/a$`b', '/a$$b'];

describe('404 page prints a path holding string replacement patterns verbatim', () => {
  beforeEach(() => {
    pathnameMock.mockReset();
  });

  for (const path of REPLACEMENT_PATTERN_PATHS) {
    it(`prints ${path} as typed in the command and in the shell error`, () => {
      pathnameMock.mockReturnValue(path);
      const { container } = render(<NotFound />);
      const text = container.querySelector(COMMAND_SELECTOR)?.textContent ?? '';
      expect(text).toContain(`cd ${path}`);
      expect(text).toContain(`bash: ${path}: no such file or directory`);
    });
  }
});
