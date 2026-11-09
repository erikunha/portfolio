import { UTM_CONTENT_PARAM, UTM_SOURCE, UTM_SOURCE_PARAM } from '@/content/links.constants';

const TAGGABLE_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export function withUtm(href: string, content: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (!TAGGABLE_PROTOCOLS.has(url.protocol)) return href;
  url.searchParams.set(UTM_SOURCE_PARAM, UTM_SOURCE);
  url.searchParams.set(UTM_CONTENT_PARAM, content);
  return url.toString();
}
