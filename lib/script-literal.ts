const LINE_SEPARATOR_CODE = 0x2028;
const PARAGRAPH_SEPARATOR_CODE = 0x2029;
const LINE_SEPARATOR = String.fromCharCode(LINE_SEPARATOR_CODE);
const PARAGRAPH_SEPARATOR = String.fromCharCode(PARAGRAPH_SEPARATOR_CODE);

const SCRIPT_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '/': '\\u002f',
  [LINE_SEPARATOR]: '\\u2028',
  [PARAGRAPH_SEPARATOR]: '\\u2029',
};
const SCRIPT_UNSAFE = new RegExp(`[<>/${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, 'g');

export function scriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(SCRIPT_UNSAFE, (char) => SCRIPT_ESCAPES[char] ?? char);
}
