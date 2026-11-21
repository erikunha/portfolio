export type ClassPart = string | false | null | undefined;

export function joinClassNames(...parts: ClassPart[]): string {
  return parts.filter(Boolean).join(' ');
}
