const LINE_BREAK = '\n';

type Listener = () => void;

let message = '';
let fieldId: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

function write(next: string): void {
  if (next === message) return;
  message = next;
  notify();
}

export const messageStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
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
