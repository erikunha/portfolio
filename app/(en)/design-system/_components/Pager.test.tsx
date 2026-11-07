import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pager } from './Pager';

describe('Pager', () => {
  it('renders the pagination navigation with an accessible label', () => {
    render(<Pager slug="tokens" />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).not.toBeNull();
  });

  it('renders only the next link on the overview page', () => {
    render(<Pager slug="" />);
    expect(screen.queryByRole('link', { name: /^Previous:/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next: Tokens' })).not.toBeNull();
  });

  it('links the overview next entry to the tokens route', () => {
    render(<Pager slug="" />);
    expect(screen.getByRole('link', { name: 'Next: Tokens' }).getAttribute('href')).toBe(
      '/design-system/tokens',
    );
  });

  it('renders previous and next links in the middle of the chain', () => {
    render(<Pager slug="tokens" />);
    const prev = screen.getByRole('link', { name: 'Previous: Overview' });
    const next = screen.getByRole('link', { name: 'Next: Components' });
    expect(prev.getAttribute('href')).toBe('/design-system');
    expect(next.getAttribute('href')).toBe('/design-system/components');
  });

  it('renders previous and next links on the components page', () => {
    render(<Pager slug="components" />);
    expect(screen.getByRole('link', { name: 'Previous: Tokens' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Next: Enforcement' })).not.toBeNull();
  });

  it('renders previous and next links on the enforcement page', () => {
    render(<Pager slug="enforcement" />);
    expect(screen.getByRole('link', { name: 'Previous: Components' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Next: Changelog' })).not.toBeNull();
  });

  it('renders only the previous link on the changelog page', () => {
    render(<Pager slug="changelog" />);
    expect(screen.getByRole('link', { name: 'Previous: Enforcement' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: /^Next:/ })).toBeNull();
  });

  it('renders nothing for a route outside the pager chain', () => {
    const { container } = render(<Pager slug="primitives/button" />);
    expect(container.firstChild).toBeNull();
  });

  it('marks the previous link with the pager-prev class and the next link with pager-next', () => {
    render(<Pager slug="tokens" />);
    expect(
      screen.getByRole('link', { name: 'Previous: Overview' }).classList.contains('pager-prev'),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'Next: Components' }).classList.contains('pager-next'),
    ).toBe(true);
  });
});
