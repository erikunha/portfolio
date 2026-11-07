const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};
const ESCAPED_PATTERN = /[<\u2028\u2029]/g;

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(ESCAPED_PATTERN, (char) => ESCAPES[char] ?? char);
}
