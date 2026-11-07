declare global {
  interface WindowEventMap {
    [SYSFAIL_START]: CustomEvent;
    [SYSFAIL_END]: CustomEvent;
    'shell-cmd-run': CustomEvent;
    'hero:sysfail:show': CustomEvent;
    'hero:sysfail:hide': CustomEvent;
  }
}

export const SYSFAIL_START = 'sysfail:start';
export const SYSFAIL_END = 'sysfail:end';
