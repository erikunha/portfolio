import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_LINK_PROPS, ExternalLink, externalLinkProps } from './ExternalLink';

describe('ExternalLink', () => {
  it('opens in a new tab with noopener noreferrer', () => {
    render(<ExternalLink href="https://example.com">out</ExternalLink>);
    const link = screen.getByRole('link', { name: 'out' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('forwards other anchor attributes', () => {
    render(
      <ExternalLink href="https://example.com" className="x" aria-label="named">
        out
      </ExternalLink>,
    );
    const link = screen.getByRole('link', { name: 'named' });
    expect(link.className).toBe('x');
  });

  it('externalLinkProps returns the pair only for an external target', () => {
    expect(externalLinkProps(true)).toEqual(EXTERNAL_LINK_PROPS);
    expect(externalLinkProps(false)).toEqual({});
  });
});
