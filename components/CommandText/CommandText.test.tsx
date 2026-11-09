import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandText } from './CommandText';

describe('CommandText', () => {
  it('keeps the text of the command unchanged', () => {
    const { container } = render(<CommandText>git log --oneline --decorate ~/career</CommandText>);
    expect(container.textContent).toBe('git log --oneline --decorate ~/career');
  });

  it('wraps each word in its own unbreakable span so a flag cannot split after its dashes', () => {
    const { container } = render(<CommandText>git log --oneline --decorate</CommandText>);
    const words = [...container.querySelectorAll('.cmd-word')].map((word) => word.textContent);
    expect(words, 'a flag is one word: breaking after "--" leaves the dashes alone').toEqual([
      'git',
      'log',
      '--oneline',
      '--decorate',
    ]);
  });

  it('leaves the spaces between words as plain text, the only break points', () => {
    const { container } = render(<CommandText>a --b c</CommandText>);
    const spaces = [...container.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
    expect(spaces.map((node) => node.textContent)).toEqual([' ', ' ']);
  });
});
