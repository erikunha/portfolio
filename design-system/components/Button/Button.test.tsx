import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders as <button> by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toBeDefined();
  });
  it('renders as <a> when as="a"', () => {
    render(
      <Button as="a" href="/test">
        Link
      </Button>,
    );
    expect(screen.getByRole('link')).toBeDefined();
  });
  it('applies disabled state and aria-disabled on anchor', () => {
    const { container } = render(
      <Button as="a" href="/test" disabled>
        Disabled
      </Button>,
    );
    const el = container.querySelector('a');
    expect(el?.getAttribute('aria-disabled')).toBe('true');
    expect(el?.getAttribute('href')).toBeNull();
    expect(el?.getAttribute('tabindex')).toBe('-1');
  });
  it('does not allow caller aria-disabled to override disabled=true on anchor', () => {
    const { container } = render(
      <Button as="a" href="/test" disabled aria-disabled="false">
        Disabled
      </Button>,
    );
    const el = container.querySelector('a');
    expect(el?.getAttribute('aria-disabled')).toBe('true');
  });
  it('preserves consumer attributes for buttons and links', () => {
    render(
      <>
        <Button id="action" className="consumer" aria-label="Run action" />
        <Button as="a" href="/test" id="destination" className="consumer" aria-label="Open page" />
      </>,
    );
    for (const [role, name, id] of [
      ['button', 'Run action', 'action'],
      ['link', 'Open page', 'destination'],
    ] as const) {
      const control = screen.getByRole(role, { name });
      expect(control.id).toBe(id);
      expect(control.classList.contains('consumer')).toBe(true);
    }
  });
  it('blocks activation of disabled buttons and anchors', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button disabled onClick={onClick}>
          Disabled button
        </Button>
        <Button as="a" href="/test" disabled onClick={onClick}>
          Disabled link
        </Button>
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disabled button' }));
    expect(fireEvent.click(screen.getByText('Disabled link'))).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('applies primary variant styles by default', () => {
    const { container } = render(<Button>Primary</Button>);
    const el = container.firstElementChild;
    expect(el?.classList.contains('bg-primary-500')).toBe(true);
    expect(el?.classList.contains('border-primary-500')).toBe(true);
  });
  it('applies secondary variant styles', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const el = container.firstElementChild;
    expect(el?.classList.contains('bg-transparent')).toBe(true);
    expect(el?.classList.contains('text-primary-500')).toBe(true);
  });
  it('keeps the small target at 44px and the large target at 52px', () => {
    const { container: smContainer } = render(<Button size="sm">Sm</Button>);
    expect(smContainer.firstElementChild?.classList.contains('min-h-11')).toBe(true);
    const { container: lgContainer } = render(<Button size="lg">Lg</Button>);
    expect(lgContainer.firstElementChild?.classList.contains('min-h-[52px]')).toBe(true);
  });
});
