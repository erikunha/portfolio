type TokenMap = Record<string, { $value: string | number }>;

export function resolveValue(value: string | number, tokens: TokenMap): string {
  if (typeof value === 'number') return String(value);
  const ref = value.match(/^\{(.+)\}$/);
  if (ref?.[1]) {
    const target = tokens[ref[1]];
    if (!target) return value;
    return resolveValue(target.$value, tokens);
  }
  return value;
}
