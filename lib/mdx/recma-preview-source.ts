// Recma plugin (ESTree level) — injects `source` prop into <Preview> elements.
// Must be referenced by path string in next.config.ts (Turbopack requirement).

import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import { visit } from 'estree-util-visit';

export default function recmaPreviewSource() {
  return (tree: Program) => {
    visit(tree, (node) => {
      if (node.type !== 'JSXElement') return;
      const el = node as unknown as {
        openingElement: {
          name: { name?: string };
          attributes: unknown[];
        };
        children: unknown[];
      };
      if (el.openingElement.name.name !== 'Preview') return;

      // Serialize children back to JSX source string
      const childSource = el.children
        .map((child) => {
          try {
            return toJs(child as Parameters<typeof toJs>[0]).value.trim();
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .join('\n');

      // Inject as a string `source` prop
      el.openingElement.attributes.push({
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name: 'source' },
        value: { type: 'Literal', value: childSource },
      });
    });
  };
}
