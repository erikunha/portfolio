import type { ReactNode } from 'react';
import type { TerminalChrome } from '@/content/schemas';
import { TerminalChromeBar } from '../TerminalChromeBar';

export function ContactShell({
  chrome,
  children,
}: {
  chrome: TerminalChrome;
  children: ReactNode;
}) {
  return (
    <div className="contact-shell">
      <TerminalChromeBar
        chrome={chrome}
        className="contact-chrome"
        tagClassName="contact-channel"
      />
      <div className="contact-body">{children}</div>
    </div>
  );
}
