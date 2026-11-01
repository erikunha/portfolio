export function isolate(root: HTMLElement): () => void {
  const isolated: Element[] = [];
  for (
    let node: HTMLElement | null = root;
    node && node !== document.body;
    node = node.parentElement
  ) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '');
        isolated.push(sibling);
      }
    }
  }
  return () => {
    for (const element of isolated) element.removeAttribute('inert');
  };
}
