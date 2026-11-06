'use client';

import type { ReactNode } from 'react';
import { MAIN_CONTENT_ID } from '@/components/PageMain';
import type { ErrorsContent } from '@/content/schemas';

export function ErrorChrome({
  chrome,
  brand,
}: {
  chrome: ErrorsContent['chrome'];
  brand: ReactNode;
}) {
  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className="skip-to-content">
        {chrome.skipLabel}
      </a>
      <header className="err-bar">
        <nav aria-label={chrome.navLabel}>
          {chrome.nav.map((item) => (
            <a key={item.href} className="err-bar-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        {brand}
      </header>
    </>
  );
}
