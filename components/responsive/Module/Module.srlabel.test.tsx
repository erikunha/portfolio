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

  it('keeps the command out of the heading name and tags it English when a localized name is given', () => {
    const { container } = render(
      <Module id="sec-z" header="SUDO CONTACT --INIT" mobileHeader="SUDO CONTACT" name="CONTATO">
        <div />
      </Module>,
    );
    const commands = container.querySelectorAll('h2 .module-scroll-type');
    expect(commands).toHaveLength(2);
    for (const command of commands) {
      expect(
        command.getAttribute('aria-hidden'),
        'English command text inside a Portuguese heading name breaks WCAG 3.1.2, and the localized name already names the section',
      ).toBe('true');
      expect(command.getAttribute('lang')).toBe('en');
    }
  });

  it('keeps the command in the heading name, tagged English, when nothing else names the section', () => {
    const { container } = render(
      <Module id="sec-w" header="LS -LA ./W">
        <div />
      </Module>,
    );
    for (const command of container.querySelectorAll('h2 .module-scroll-type')) {
      expect(command.getAttribute('aria-hidden')).toBeNull();
      expect(command.getAttribute('lang')).toBe('en');
    }
  });
});
