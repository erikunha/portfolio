export type ModifierKey = 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';

const MODIFIER_KEYS: readonly ModifierKey[] = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];

export function hasModifier(
  event: Readonly<Record<ModifierKey, boolean>>,
  allowed: readonly ModifierKey[] = [],
): boolean {
  return MODIFIER_KEYS.some((key) => event[key] && !allowed.includes(key));
}
