import { createListeners } from '@/lib/listeners';

const LINE_BREAK = '\n';

let message = '';
let fieldId: string | null = null;
const listeners = createListeners();

function notify(): void {
  listeners.notify();
}

function write(next: string): void {
  if (next === message) return;
  message = next;
  notify();
}

export const messageStore = {
  subscribe: listeners.subscribe,
  getSnapshot: (): string => message,
  getServerSnapshot: (): string => '',
  getFieldId: (): string | null => fieldId,
  bindField(id: string): () => void {
    fieldId = id;
    notify();
    return () => {
      if (fieldId !== id) return;
      fieldId = null;
      notify();
    };
  },
  set: write,
  seed(typed: string): void {
    if (typed === '' || typed === message) return;
    write(message === '' ? typed : `${typed}${LINE_BREAK}${message}`);
  },
  append(line: string): boolean {
    if (message.includes(line)) return false;
    if (message.trim() === '') write(line);
    else write(`${message}${message.endsWith(LINE_BREAK) ? '' : LINE_BREAK}${line}`);
    return true;
  },
  reset: () => write(''),
};
