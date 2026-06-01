// WHY: cn uses clsx only (not tailwind-merge) to keep the client bundle under
// the 220KB gzip gate. tailwind-merge adds ~4KB gzipped and is not needed here
// because no call site has conflicting Tailwind class names that require merge
// resolution — they only need conditional class joining. If a component ever
// requires deduplication (e.g. overriding a base class in a variant), import
// twMerge locally in that RSC file (server-only; never ships to the client).
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
