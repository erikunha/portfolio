function walk(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, fn);
  }
}

export default function remarkPreviewSource() {
  return (tree, file) => {
    const src = String(file.value);

    walk(tree, (node) => {
      if (node.type !== 'mdxJsxFlowElement' || node.name !== 'Preview') return;
      if (!node.children?.length) return;

      const firstChild = node.children[0];
      const lastChild = node.children[node.children.length - 1];
      if (!firstChild?.position || !lastChild?.position) return;

      const childSource = src
        .slice(firstChild.position.start.offset, lastChild.position.end.offset)
        .trim();

      node.attributes.push({
        type: 'mdxJsxAttribute',
        name: 'source',
        value: childSource,
      });
    });
  };
}
