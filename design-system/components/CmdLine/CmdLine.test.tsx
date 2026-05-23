import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CmdLine } from './CmdLine';
import styles from './CmdLine.module.css';

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
    expect(container.querySelector(`.${styles.output as string}`)).toBeNull();
  });
});
