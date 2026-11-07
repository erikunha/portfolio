import { cn } from './cn';

export const DEFERRED_CLASS = 'module-deferred';
export const DEFER_ATTRIBUTE = 'data-cv-defer';

export function deferProps(defer: boolean | undefined, className?: string) {
  return {
    className: cn(className, defer && DEFERRED_CLASS) || undefined,
    ...(defer ? { [DEFER_ATTRIBUTE]: 'true' } : {}),
  };
}
