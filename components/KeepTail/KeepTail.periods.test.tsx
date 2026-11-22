import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeepTail } from './KeepTail';

const kept = (container: HTMLElement) =>
  [...container.querySelectorAll('.keep-together')].map((node) => node.textContent);

describe('KeepTail year ranges', () => {
  it('keeps a trailing year range with its separator and the word before it', () => {
    const { container } = render(<KeepTail>CICCC · Vancouver, Canada · 2023-2024</KeepTail>);
    expect(container.textContent).toBe('CICCC · Vancouver, Canada · 2023-2024');
    expect(kept(container)).toContain('Canada · 2023-2024');
  });

  it('keeps a year range that sits before more text', () => {
    const { container } = render(
      <KeepTail>UNISAL · Campinas, Brasil · 2015-2020 · Sistemas de Informação</KeepTail>,
    );
    expect(container.textContent).toBe(
      'UNISAL · Campinas, Brasil · 2015-2020 · Sistemas de Informação',
    );
    expect(kept(container)).toContain('Brasil · 2015-2020');
  });

  it('keeps every year range when two appear', () => {
    const { container } = render(<KeepTail>A · 2015-2020 · B · 2023-2024</KeepTail>);
    expect(kept(container)).toEqual(['A · 2015-2020', 'B · 2023-2024']);
  });
});
