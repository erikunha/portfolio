// Recma plugin (ESTree level) — injects `source` prop into <Preview> elements.
// Must be .mjs (ESM) so dynamic import() can load it. Referenced by explicit
// path string in next.config.ts (Turbopack serialization requirement).
import { toJs } from 'estree-util-to-js';
import { visit } from 'estree-util-visit';

export default function recmaPreviewSource() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'JSXElement') return;
      if (node.openingElement.name.name !== 'Preview') return;

      const childSource = node.children
        .map((child) => {
          try {
            return toJs(child).value.trim();
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .join('\n');

      node.openingElement.attributes.push({
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name: 'source' },
        value: { type: 'Literal', value: childSource },
      });
    });
  };
}
