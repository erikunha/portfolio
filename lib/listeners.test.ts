import { describe, expect, it, vi } from 'vitest';
import { createListeners } from './listeners';

describe('createListeners', () => {
  it('calls a subscribed listener on every notify', () => {
    const listeners = createListeners();
    const listener = vi.fn();
    listeners.subscribe(listener);
    listeners.notify();
    listeners.notify();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('passes the notified value to each listener', () => {
    const listeners = createListeners<string>();
    const listener = vi.fn();
    listeners.subscribe(listener);
    listeners.notify('a');
    expect(listener).toHaveBeenCalledWith('a');
  });

  it('stops calling a listener after it unsubscribes', () => {
    const listeners = createListeners();
    const listener = vi.fn();
    const unsubscribe = listeners.subscribe(listener);
    unsubscribe();
    listeners.notify();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps other listeners when one unsubscribes twice', () => {
    const listeners = createListeners();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = listeners.subscribe(first);
    listeners.subscribe(second);
    unsubscribeFirst();
    unsubscribeFirst();
    listeners.notify();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(listeners.size()).toBe(1);
  });

  it('reports the number of subscribed listeners', () => {
    const listeners = createListeners();
    expect(listeners.size()).toBe(0);
    const unsubscribe = listeners.subscribe(() => undefined);
    listeners.subscribe(() => undefined);
    expect(listeners.size()).toBe(2);
    unsubscribe();
    expect(listeners.size()).toBe(1);
  });

  it('notifies in subscription order', () => {
    const listeners = createListeners();
    const order: number[] = [];
    listeners.subscribe(() => order.push(1));
    listeners.subscribe(() => order.push(2));
    listeners.subscribe(() => order.push(3));
    listeners.notify();
    expect(order).toEqual([1, 2, 3]);
  });

  it('skips a later listener removed by an earlier one during notify', () => {
    const listeners = createListeners();
    const later = vi.fn();
    let unsubscribeLater: () => void = () => undefined;
    listeners.subscribe(() => unsubscribeLater());
    unsubscribeLater = listeners.subscribe(later);
    listeners.notify();
    expect(later).not.toHaveBeenCalled();
  });

  it('lets a listener unsubscribe itself during notify without hiding the next one', () => {
    const listeners = createListeners();
    const next = vi.fn();
    const unsubscribe = listeners.subscribe(() => unsubscribe());
    listeners.subscribe(next);
    listeners.notify();
    expect(next).toHaveBeenCalledTimes(1);
    expect(listeners.size()).toBe(1);
  });

  it('calls a listener added during notify in that same notify', () => {
    const listeners = createListeners();
    const added = vi.fn();
    const adder = vi.fn(() => {
      if (listeners.size() === 1) listeners.subscribe(added);
    });
    listeners.subscribe(adder);
    listeners.notify();
    expect(added).toHaveBeenCalledTimes(1);
    listeners.notify();
    expect(added).toHaveBeenCalledTimes(2);
  });
});
