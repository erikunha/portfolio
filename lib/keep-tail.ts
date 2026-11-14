const NO_BREAK_SPACE = ' ';
const SPACE = ' ';
const SHORT_TAIL_MAX_CHARS = 8;
const SEPARATOR_ONLY = /^[^\p{L}\p{N}]+$/u;

export type TextTail = { head: string; tail: string };

export function splitTail(text: string): TextTail {
  const words = text.split(SPACE);
  const last = words.at(-1);
  if (words.length < 2 || last === undefined || last.length > SHORT_TAIL_MAX_CHARS) {
    return { head: text, tail: '' };
  }
  const previous = words.at(-2);
  const joinsSeparator =
    previous !== undefined && SEPARATOR_ONLY.test(previous) && words.length > 2;
  const glued = joinsSeparator ? 2 : 1;
  return {
    head: words.slice(0, -(glued + 1)).join(SPACE),
    tail: words.slice(-(glued + 1)).join(SPACE),
  };
}

export function keepTail(text: string): string {
  const { head, tail } = splitTail(text);
  if (tail === '') return text;
  const glued = tail.replaceAll(SPACE, NO_BREAK_SPACE);
  return head === '' ? glued : `${head}${SPACE}${glued}`;
}
