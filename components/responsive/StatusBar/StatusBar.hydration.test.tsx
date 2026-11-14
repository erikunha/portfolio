import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBar } from './StatusBar.client';

describe('StatusBar hydration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('hydrates server markup without a mismatch warning', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const container = document.createElement('div');
    container.innerHTML = renderToString(<StatusBar />);
    document.body.append(container);
    await act(async () => {
      hydrateRoot(container, <StatusBar />);
    });
    expect(errors).not.toHaveBeenCalled();
  });
});
