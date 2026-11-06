import type { TerminalChrome } from '@/content/schemas';
import { WindowChrome } from '@/design-system';

export function TerminalChromeBar({
  chrome,
  className,
  tagClassName,
  dotSize,
  compact = false,
}: {
  chrome: TerminalChrome;
  className: string;
  tagClassName: string;
  dotSize?: number;
  compact?: boolean;
}) {
  return (
    <div className={className}>
      <WindowChrome {...(dotSize === undefined ? {} : { size: dotSize })} />
      {compact ? (
        <span className={tagClassName}>{chrome.mobileLabel ?? chrome.rightTag}</span>
      ) : (
        <>
          <span>{chrome.promptLabel}</span>
          <span className={tagClassName}>{chrome.rightTag}</span>
        </>
      )}
    </div>
  );
}
