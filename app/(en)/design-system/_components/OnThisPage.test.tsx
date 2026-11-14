import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnThisPage } from './OnThisPage';

describe('OnThisPage', () => {
  it('renders no navigation, and no orphan title, when the page has no sections', () => {
    const { container } = render(<OnThisPage items={[]} />);
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders every section as a link to its heading', () => {
    render(
      <OnThisPage
        items={[
          { id: 'sections', label: 'Sections' },
          { id: 'principles', label: 'Principles' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const links = [...nav.querySelectorAll('a')].map((link) => [
      link.textContent,
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Sections', '#sections'],
      ['Principles', '#principles'],
    ]);
  });
});
