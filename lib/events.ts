declare global {
  interface WindowEventMap {
    'module:open': CustomEvent<{ id: string }>;
    'sysfail:start': CustomEvent;
    'sysfail:end': CustomEvent;
    'shell-cmd-run': CustomEvent;
  }
}

export {};
