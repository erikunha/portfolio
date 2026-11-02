import { afterEach, describe, expect, it, vi } from 'vitest';
import { messageStore } from './messageStore';

afterEach(() => {
  messageStore.reset();
});

describe('messageStore', () => {
  it('starts empty and returns what was set', () => {
    expect(messageStore.getSnapshot()).toBe('');

    messageStore.set('hello');

    expect(messageStore.getSnapshot()).toBe('hello');
  });

  it('notifies subscribers once per change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = messageStore.subscribe(listener);

    messageStore.set('a');
    messageStore.set('a');
    messageStore.set('b');
    unsubscribe();
    messageStore.set('c');

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('appends on a new line when text is already there', () => {
    messageStore.set('Hi Erik');

    messageStore.append('Proposed call: 13:30');

    expect(messageStore.getSnapshot()).toBe('Hi Erik\nProposed call: 13:30');
  });

  it('appends without a leading newline to an empty or blank message', () => {
    messageStore.append('Proposed call: 13:30');
    expect(messageStore.getSnapshot()).toBe('Proposed call: 13:30');

    messageStore.set('  \n');
    messageStore.append('Proposed call: 13:30');
    expect(messageStore.getSnapshot()).toBe('Proposed call: 13:30');
  });

  it('does not double the line break after a message that ends with one', () => {
    messageStore.set('Hi Erik\n');

    messageStore.append('Proposed call: 13:30');

    expect(messageStore.getSnapshot()).toBe('Hi Erik\nProposed call: 13:30');
  });

  it('does not append a line that is already in the message', () => {
    messageStore.append('Proposed call: 13:30');
    const listener = vi.fn();
    messageStore.subscribe(listener);

    const added = messageStore.append('Proposed call: 13:30');

    expect(added).toBe(false);
    expect(messageStore.getSnapshot()).toBe('Proposed call: 13:30');
    expect(listener).not.toHaveBeenCalled();
  });

  it('serves an empty message on the server', () => {
    messageStore.set('typed');

    expect(messageStore.getServerSnapshot()).toBe('');
  });
});
