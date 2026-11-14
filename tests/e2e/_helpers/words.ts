import type { Page } from '@playwright/test';

export const WORD_VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 800 },
  { width: 768, height: 1024 },
] as const;

export const ORPHAN_MAX_CHARS = 5;
const SCROLL_STEP_PX = 600;
const ALLOWED_BREAK_AFTER = '_/.@';

export type WordFinding = { word: string; host: string; breaks: string };

const CODE_SAMPLES = 'pre';
const SKIPPED_TAGS = `script, style, noscript, canvas, svg, .sr-only, ${CODE_SAMPLES}`;

export async function renderEverything(page: Page): Promise<void> {
  await page.addStyleTag({ content: '* { content-visibility: visible !important; }' });
  await page.evaluate(
    async ([step]) => {
      const last = document.documentElement.scrollHeight;
      for (let y = 0; y <= last; y += Number(step)) {
        window.scrollTo(0, y);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    },
    [SCROLL_STEP_PX] as const,
  );
}

export function splitWords(
  page: Page,
  scope = 'body',
  allowedBreakAfter = ALLOWED_BREAK_AFTER,
): Promise<WordFinding[]> {
  return page.evaluate(
    ([root, skipped, allowedAfter]) => {
      const found: WordFinding[] = [];
      const scopeNode = document.querySelector(String(root));
      if (!scopeNode) return found;
      const labelOf = (node: Element) =>
        `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/).join('.')}` : ''}`;
      const walker = document.createTreeWalker(scopeNode, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const topOf = (text: Text, offset: number) => {
        range.setStart(text, offset);
        range.setEnd(text, offset + 1);
        return Math.round(range.getBoundingClientRect().top);
      };
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        const parent = text.parentElement;
        if (!parent || parent.closest(String(skipped))) continue;
        if (!parent.checkVisibility({ checkVisibilityCSS: true })) continue;
        for (const match of text.data.matchAll(/\S+/g)) {
          const word = match[0];
          if (word.includes('-')) continue;
          const start = match.index ?? 0;
          range.setStart(text, start);
          range.setEnd(text, start + word.length);
          const lines = new Set(
            [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
          );
          if (lines.size < 2) continue;
          const breaks: string[] = [];
          for (let i = 1; i < word.length; i += 1) {
            if (topOf(text, start + i) !== topOf(text, start + i - 1)) {
              breaks.push(word[i - 1] ?? '');
            }
          }
          const sensible = breaks.every((char) => String(allowedAfter).includes(char));
          if (!sensible) {
            found.push({ word, host: labelOf(parent), breaks: breaks.join('') });
          }
        }
      }
      return found;
    },
    [scope, SKIPPED_TAGS, allowedBreakAfter] as const,
  );
}

export function lastLineOrphans(page: Page, scope: string): Promise<WordFinding[]> {
  return page.evaluate(
    ([root, skipped, maxChars]) => {
      type Piece = { token: string; tops: number[] };
      const found: WordFinding[] = [];
      const scopeNode = document.querySelector(String(root));
      if (!scopeNode) return found;
      const labelOf = (node: Element) =>
        `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/).join('.')}` : ''}`;
      const blockOf = (node: Element): Element => {
        let current: Element | null = node;
        while (current && current !== scopeNode) {
          const display = getComputedStyle(current).display;
          if (!display.startsWith('inline') && display !== 'contents') return current;
          current = current.parentElement;
        }
        return scopeNode;
      };
      const blocks = new Map<Element, Piece[]>();
      const walker = document.createTreeWalker(scopeNode, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        const parent = text.parentElement;
        if (!parent || parent.closest(String(skipped))) continue;
        if (!parent.checkVisibility({ checkVisibilityCSS: true })) continue;
        const block = blockOf(parent);
        for (const match of text.data.matchAll(/[^ \t\n\r]+/g)) {
          const start = match.index ?? 0;
          range.setStart(text, start);
          range.setEnd(text, start + match[0].length);
          const tops = [...range.getClientRects()]
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.round(rect.top));
          if (tops.length === 0) continue;
          const pieces = blocks.get(block) ?? [];
          pieces.push({ token: match[0], tops });
          blocks.set(block, pieces);
        }
      }
      for (const [block, pieces] of blocks) {
        if (pieces.length < 2) continue;
        const lines = new Set(pieces.flatMap((piece) => piece.tops));
        if (lines.size < 2) continue;
        const lastLine = Math.max(...lines);
        const onLast = pieces.filter((piece) => piece.tops.includes(lastLine));
        const [only] = onLast;
        if (onLast.length === 1 && only && only.token.length <= Number(maxChars)) {
          found.push({ word: only.token, host: labelOf(block), breaks: '' });
        }
      }
      return found;
    },
    [scope, SKIPPED_TAGS, ORPHAN_MAX_CHARS] as const,
  );
}
