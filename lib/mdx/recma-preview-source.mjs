// DEPRECATED: recma plugins run after JSX compilation — no JSXElement nodes exist.
// Use remark-preview-source.mjs instead (runs at MDAST stage before JSX compile).
export default function recmaPreviewSource() {
  return (_tree) => {
    // no-op
  };
}
