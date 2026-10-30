import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavItem } from './NavItem';

describe('NavItem', () => {
  it('renders a link carrying the label', () => {
    render(<NavItem href="/#sec-projects" label="Projects" />);
    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link.getAttribute('href')).toBe('/#sec-projects');
  });

  it('marks the current item with aria-current="location" and no other item', () => {
    render(
      <>
        <NavItem href="/#a" label="Alpha" current />
        <NavItem href="/#b" label="Beta" />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Alpha' }).getAttribute('aria-current')).toBe(
      'location',
    );
    expect(screen.getByRole('link', { name: 'Beta' }).hasAttribute('aria-current')).toBe(false);
  });

  it('hides the index from assistive technology and keeps it out of the link name', () => {
    render(<NavItem href="/#a" label="Alpha" index="01" />);
    const index = screen.getByText('01');
    expect(index.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toBeNull();
  });

  it('passes consumer attributes through and merges className instead of replacing it', () => {
    const onClick = vi.fn();
    render(
      <NavItem
        href="https://example.com"
        label="Out"
        id="consumer-id"
        className="extra"
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Out, opens in a new tab"
        onClick={onClick}
      />,
    );
    const link = screen.getByRole('link', { name: 'Out, opens in a new tab' });
    expect(link.id).toBe('consumer-id');
    expect(link.classList.contains('nav-item')).toBe(true);
    expect(link.classList.contains('extra')).toBe(true);
    expect(link.getAttribute('target')).toBe('_blank');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('can render twice without sharing an id', () => {
    const { container } = render(
      <>
        <NavItem href="/#a" label="Alpha" index="01" />
        <NavItem href="/#a" label="Alpha" index="01" />
      </>,
    );
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
  });
});
