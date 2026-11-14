import type { Page } from '@playwright/test';

export type LineWordFinding = { word: string; host: string; line: string };

export function lastLineOrphansIn(
  page: Page,
  selector: string,
  maxChars: number,
): Promise<LineWordFinding[]> {
  return page.evaluate(
    ([target, limit]) => {
      type Piece = { token: string; tops: number[] };
      const found: LineWordFinding[] = [];
      const range = document.createRange();
      const elements = [...document.querySelectorAll(String(target))];
      for (const element of elements) {
        const pieces: Piece[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node as Text;
          if (text.parentElement?.closest('.sr-only')) continue;
          for (const match of text.data.matchAll(/[^ \t\n\r]+/g)) {
            const start = match.index ?? 0;
            range.setStart(text, start);
            range.setEnd(text, start + match[0].length);
            const tops = [...range.getClientRects()]
              .filter((rect) => rect.width > 0)
              .map((rect) => Math.round(rect.top));
            if (tops.length > 0) pieces.push({ token: match[0], tops });
          }
        }
        if (pieces.length < 2) continue;
        const lines = new Set(pieces.flatMap((piece) => piece.tops));
        if (lines.size < 2) continue;
        const lastLine = Math.max(...lines);
        const onLast = pieces.filter((piece) => piece.tops.includes(lastLine));
        const [only] = onLast;
        if (onLast.length === 1 && only && only.token.length <= Number(limit)) {
          found.push({
            word: only.token,
            host: `${element.tagName.toLowerCase()}.${String(element.className)}`,
            line: pieces
              .map((piece) => piece.token)
              .join(' ')
              .slice(0, 80),
          });
        }
      }
      return found;
    },
    [selector, maxChars] as const,
  );
}
