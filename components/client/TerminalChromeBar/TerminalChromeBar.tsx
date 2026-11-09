import type { TerminalChrome } from '@/content/schemas';
import { WindowChrome } from '@/design-system';

const HIDE_ON_PHONE = 'max-md:hidden';
const HIDE_FROM_TABLET = 'md:hidden';

export function TerminalChromeBar({
  chrome,
  className,
  tagClassName,
  dotSize,
}: {
  chrome: TerminalChrome;
  className: string;
  tagClassName: string;
  dotSize?: number;
}) {
  const hideFull = chrome.mobileLabel ? HIDE_ON_PHONE : undefined;
  return (
    <div className={className}>
      <WindowChrome {...(dotSize === undefined ? {} : { size: dotSize })} />
      <span className={hideFull}>{chrome.promptLabel}</span>
      <span className={hideFull ? `${tagClassName} ${hideFull}` : tagClassName}>
        {chrome.rightTag}
      </span>
      {chrome.mobileLabel ? (
        <span className={`${tagClassName} ${HIDE_FROM_TABLET}`}>{chrome.mobileLabel}</span>
      ) : null}
    </div>
  );
}
