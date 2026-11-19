import { act } from 'react';
import { flushFrames, flushMicrotasks } from './render';

export const HIDDEN = '[aria-hidden="true"]';

const OBSERVED = { childList: true, subtree: true, characterData: true } as const;

export function accessibleText(node: Node): string {
  if (node instanceof Element && node.matches(HIDDEN)) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  return Array.from(node.childNodes, accessibleText).join('');
}

function exposed(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return element !== null && element.closest(HIDDEN) === null;
}

export function recordMutations(target: Node): { records: MutationRecord[]; stop: () => void } {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((batch) => records.push(...batch));
  observer.observe(target, OBSERVED);
  return {
    records,
    stop: () => {
      records.push(...observer.takeRecords());
      observer.disconnect();
    },
  };
}

export function accessibleChanges(records: MutationRecord[]): string[] {
  const changes: string[] = [];
  for (const record of records) {
    if (record.type === 'characterData' && exposed(record.target)) {
      changes.push(record.target.textContent ?? '');
    }
    for (const added of record.addedNodes) {
      if (exposed(added)) changes.push(accessibleText(added));
    }
  }
  return changes;
}

export function heldStream(): {
  body: ReadableStream<Uint8Array>;
  push: (text: string) => Promise<void>;
  close: () => Promise<void>;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const settle = async () => {
    await flushMicrotasks();
    await flushFrames();
  };
  return {
    body,
    push: async (text) => {
      await act(async () => controller?.enqueue(encoder.encode(text)));
      await settle();
    },
    close: async () => {
      await act(async () => controller?.close());
      await settle();
    },
  };
}
