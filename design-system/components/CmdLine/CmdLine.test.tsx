import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CmdLine } from './CmdLine';

describe('CmdLine', () => {
  it('renders user, prompt, and command', () => {
    render(<CmdLine command="ls -la" />);
    expect(screen.getByText(/erik@portfolio/)).toBeDefined();
    expect(screen.getByText(':~$')).toBeDefined();
    expect(screen.getByText('ls -la')).toBeDefined();
  });
  it('renders custom user and prompt', () => {
    render(<CmdLine user="root@box" prompt="#" command="whoami" />);
    expect(screen.getByText(/root@box/)).toBeDefined();
    expect(screen.getByText('#')).toBeDefined();
  });
  it('renders output slot when output provided', () => {
    render(<CmdLine command="echo hi" output={<span>hi</span>} />);
    expect(screen.getByText('hi')).toBeDefined();
  });
  it('does not render output wrapper when output is undefined', () => {
    const { container } = render(<CmdLine command="ls" />);
    expect(container.firstElementChild?.childElementCount).toBe(1);
  });
  it('merges a consumer className and forwards id, aria and data attributes to the root', () => {
    const { container } = render(
      <CmdLine command="ls" className="extra" id="cmd-1" aria-label="shell" data-testid="cmd" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.id).toBe('cmd-1');
    expect(root.getAttribute('aria-label')).toBe('shell');
    expect(root.getAttribute('data-testid')).toBe('cmd');
    expect(root.classList.contains('extra')).toBe(true);
    expect(root.classList.contains('cmd-line')).toBe(true);
  });
  it('renders two instances without sharing identity', () => {
    const { container } = render(
      <>
        <CmdLine command="a" id="one" />
        <CmdLine command="b" id="two" />
      </>,
    );
    expect(container.querySelector('#one')).not.toBeNull();
    expect(container.querySelector('#two')).not.toBeNull();
  });
});
