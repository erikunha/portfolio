export function recordBy<T, K extends string, V>(
  items: readonly T[],
  keyFor: (item: T) => K,
  valueFor: (item: T) => V,
): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const item of items) record[keyFor(item)] = valueFor(item);
  return record;
}
