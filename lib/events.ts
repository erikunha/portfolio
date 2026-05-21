declare global {
  interface WindowEventMap {
    'module:open': CustomEvent<{ id: string }>;
    'sysfail:start': CustomEvent;
    'sysfail:end': CustomEvent;
    'shell-cmd-run': CustomEvent;
  }
}

export function dispatchModuleOpen(id: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('module:open', { detail: { id } }));
}
