const LINE_BREAK = '\n';

type Listener = () => void;

let message = '';
const listeners = new Set<Listener>();

function write(next: string): void {
  if (next === message) return;
  message = next;
  for (const listener of listeners) listener();
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
  set: write,
  append(line: string): boolean {
    if (message.includes(line)) return false;
    if (message.trim() === '') write(line);
    else write(`${message}${message.endsWith(LINE_BREAK) ? '' : LINE_BREAK}${line}`);
    return true;
  },
  reset: () => write(''),
};
