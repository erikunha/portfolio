const HEADING_TYPE = 'heading';
const TABLE_TYPE = 'table';
const JSX_HEADING_NAME = /^h[1-6]$/;

function textOf(node) {
  if (typeof node.value === 'string') return node.value;
  if (Array.isArray(node.children)) return node.children.map(textOf).join('');
  return '';
}

export default function remarkTableCaption() {
  return (tree) => {
    let caption;
    const visit = (node) => {
      const isMarkdownHeading = node.type === HEADING_TYPE;
      const isJsxHeading =
        node.type === 'mdxJsxFlowElement' && JSX_HEADING_NAME.test(node.name ?? '');
      if (isMarkdownHeading || isJsxHeading) {
        const text = textOf(node).trim();
        caption = text.length > 0 ? text : caption;
      }
      if (node.type === TABLE_TYPE && caption !== undefined) {
        node.data = {
          ...node.data,
          hProperties: { ...node.data?.hProperties, caption },
        };
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
