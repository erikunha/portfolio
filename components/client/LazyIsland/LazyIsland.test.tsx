import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyIsland } from './LazyIsland';

function Crash(): never {
  throw new Error('island crash');
}

describe('LazyIsland', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hands the reserved island height to the crash fallback', () => {
    render(
      <LazyIsland loading={null} minHeight="240px">
        <Crash />
      </LazyIsland>,
    );
    expect(screen.getByRole('alert').style.getPropertyValue('--eb-min-height')).toBe('240px');
  });

  it('shows its own failed node instead of the default box', () => {
    render(
      <LazyIsland loading={null} failed={<p>static copy</p>}>
        <Crash />
      </LazyIsland>,
    );
    expect(screen.getByText('static copy')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
