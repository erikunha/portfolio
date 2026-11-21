export type WordHold = {
  push(chunk: string): string;
  flush(): string;
};

function trailingWordStart(text: string): number {
  let index = text.length;
  while (index > 0 && !/\s/.test(text.charAt(index - 1))) index -= 1;
  return index;
}

export function createWordHold(): WordHold {
  let held = '';
  return {
    push(chunk) {
      const text = held + chunk;
      const cut = trailingWordStart(text);
      held = text.slice(cut);
      return text.slice(0, cut);
    },
    flush() {
      const out = held;
      held = '';
      return out;
    },
  };
}
