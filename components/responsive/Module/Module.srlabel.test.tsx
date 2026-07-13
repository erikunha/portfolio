import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Module } from './Module';

describe('Module srLabel', () => {
  it('renders the srLabel as an sr-only span inside the h2 when provided', () => {
    const { container } = render(
      <Module id="sec-x" header="LS -LA ./X" srLabel="Projects">
        <div />
      </Module>,
    );
    const h2 = container.querySelector('h2');
    const sr = h2?.querySelector('span.sr-only');
    expect(sr?.textContent).toBe('Projects');
  });

  it('omits the sr-only span when no srLabel is given', () => {
    const { container } = render(
      <Module id="sec-y" header="LS -LA ./Y">
        <div />
      </Module>,
    );
    expect(container.querySelector('h2 span.sr-only')).toBeNull();
  });
});
