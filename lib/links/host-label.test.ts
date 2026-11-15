import { describe, expect, it } from 'vitest';
import { hostLabel } from '../host-label';

describe('hostLabel', () => {
  it.each([
    ['https://www.erikunha.dev', 'erikunha.dev'],
    ['https://github.com/erikunha', 'github.com/erikunha'],
    ['https://www.linkedin.com/in/erikunha/', 'linkedin.com/in/erikunha'],
    ['https://www.tiktok.com/@eriknagringaa', 'tiktok.com/@eriknagringaa'],
    ['https://www.erikunha.dev/links/en', 'erikunha.dev/links/en'],
  ])('reads %s as %s', (href, label) => {
    expect(hostLabel(href)).toBe(label);
  });

  it('drops the query string and the fragment, which are tracking noise to a reader', () => {
    expect(hostLabel('https://github.com/erikunha?utm_source=bio#top')).toBe('github.com/erikunha');
  });

  it('returns the input unchanged when it is not a parseable url', () => {
    expect(hostLabel('not a url')).toBe('not a url');
  });
});
