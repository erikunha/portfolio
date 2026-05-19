import type { PortedNames } from './types';

type RewriterOptions = {
  onWarn?: (message: string) => void;
};

export type RefRewriter = {
  rewrite(text: string): string;
};

export function createRefRewriter(ported: PortedNames, opts: RewriterOptions = {}): RefRewriter {
  const warn = opts.onWarn ?? ((m: string) => console.warn(`[refs] ${m}`));
  const firstOccurrence = new Set<string>();
  const REF = /\[\[([a-zA-Z0-9:_-]+)\]\]/g;

  return {
    rewrite(text: string): string {
      return text.replace(REF, (_match, name: string) => {
        const kind = ported.get(name);
        if (!kind) {
          warn(`[[${name}]] referenced but not in manifest — replacing with HTML comment`);
          return `<!-- originally referenced [${name}] — not ported -->`;
        }
        if (kind === 'agent') {
          if (!firstOccurrence.has(name)) {
            firstOccurrence.add(name);
            return `@${name} (or /${name})`;
          }
          return `@${name}`;
        }
        return `/${name}`;
      });
    },
  };
}
