import { within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { profile, profileLanguageLine, profileLocation } from '@/content/profile';
import { Hero } from './Hero';

function renderHero() {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<Hero />);
  return { container, ...within(container) };
}

describe('Hero identity', () => {
  it('renders one visible level-one heading with the canonical name', () => {
    const { getByRole, container } = renderHero();
    const heading = getByRole('heading', { level: 1, name: profile.displayName });
    expect(heading.classList.contains('sr-only')).toBe(false);
    expect(heading.closest('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('renders the canonical title, technologies, location, employer and languages statically', () => {
    const { getByText } = renderHero();
    for (const text of [
      profile.title,
      profile.technologyLine,
      profileLocation,
      profile.currentEmployer.context,
      profileLanguageLine,
    ]) {
      expect(getByText(text, { exact: false })).toBeDefined();
    }
  });

  it('renders every canonical action with its destination without JavaScript', () => {
    const { getByRole } = renderHero();
    for (const action of profile.actions) {
      expect(getByRole('link', { name: action.label }).getAttribute('href')).toBe(action.href);
    }
    expect(getByRole('link', { name: /hire on linkedin.*new tab/i }).getAttribute('target')).toBe(
      '_blank',
    );
  });
});
