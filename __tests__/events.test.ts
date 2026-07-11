import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchModuleOpen } from '@/lib/events';

describe('dispatchModuleOpen', () => {
  let dispatched: Event[] = [];
  let listener: (e: Event) => void;

  beforeEach(() => {
    dispatched = [];
    listener = (e) => dispatched.push(e);
    window.addEventListener('module:open', listener);
  });

  afterEach(() => {
    window.removeEventListener('module:open', listener);
    dispatched = [];
  });

  it('dispatches a module:open CustomEvent with the given id', () => {
    dispatchModuleOpen('hero');
    expect(dispatched).toHaveLength(1);
    const event = dispatched[0] as CustomEvent<{ id: string }>;
    expect(event.type).toBe('module:open');
    expect(event.detail.id).toBe('hero');
  });

  it('does not throw when called with an arbitrary id', () => {
    expect(() => dispatchModuleOpen('any-module')).not.toThrow();
  });

  it('dispatches separate events for different ids', () => {
    dispatchModuleOpen('shell');
    dispatchModuleOpen('contact');
    expect(dispatched).toHaveLength(2);
    expect((dispatched[0] as CustomEvent<{ id: string }>).detail.id).toBe('shell');
    expect((dispatched[1] as CustomEvent<{ id: string }>).detail.id).toBe('contact');
  });

  it('does not dispatch when window is undefined (SSR guard)', () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    try {
      expect(() => dispatchModuleOpen('ssr')).not.toThrow();
    } finally {
      vi.stubGlobal('window', originalWindow);
    }
  });
});
