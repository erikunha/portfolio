declare global {
  interface WindowEventMap {
    'sysfail:start': CustomEvent;
    'sysfail:end': CustomEvent;
    'shell-cmd-run': CustomEvent;
    'hero:sysfail:show': CustomEvent;
    'hero:sysfail:hide': CustomEvent;
  }
}

export {};
