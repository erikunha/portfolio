export const SYSFAIL_START = 'sysfail:start';
export const SYSFAIL_END = 'sysfail:end';
export const SHELL_COMMAND_EVENT = 'shell-cmd-run';
export const HERO_SYSFAIL_SHOW = 'hero:sysfail:show';
export const HERO_SYSFAIL_HIDE = 'hero:sysfail:hide';

declare global {
  interface WindowEventMap {
    [SYSFAIL_START]: CustomEvent;
    [SYSFAIL_END]: CustomEvent;
    [SHELL_COMMAND_EVENT]: CustomEvent;
    [HERO_SYSFAIL_SHOW]: CustomEvent;
    [HERO_SYSFAIL_HIDE]: CustomEvent;
  }
}
