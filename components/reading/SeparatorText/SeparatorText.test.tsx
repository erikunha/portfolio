import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeparatorText } from './SeparatorText';

const NO_BREAK_SPACE = ' ';
const TITLE = 'DEVOPSDAYS CAMPINAS · 2024 · ORGANIZER';

describe('SeparatorText', () => {
  it('binds each middot to the word before it so a line never starts with the dot', () => {
    const { container } = render(<SeparatorText>{TITLE}</SeparatorText>);
    expect(container.textContent).toBe(
      `DEVOPSDAYS CAMPINAS${NO_BREAK_SPACE}· 2024${NO_BREAK_SPACE}· ORGANIZER`,
    );
  });

  it('reads the same as the original once the no-break space counts as a space', () => {
    const { container } = render(<SeparatorText>{TITLE}</SeparatorText>);
    expect(container.textContent?.replaceAll(NO_BREAK_SPACE, ' ')).toBe(TITLE);
  });

  it('leaves text without a separator untouched', () => {
    const { container } = render(<SeparatorText>plain heading</SeparatorText>);
    expect(container.textContent).toBe('plain heading');
  });
});
