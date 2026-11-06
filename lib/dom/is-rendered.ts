export function isRendered(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (element.hasAttribute('inert')) return false;
  if (element.hidden) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}
