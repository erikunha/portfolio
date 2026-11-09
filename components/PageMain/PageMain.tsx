import type { ReactNode } from 'react';

import { MAIN_CONTENT_ID } from '@/content/landmarks';

export { MAIN_CONTENT_ID };

const DEFAULT_CLASS = 'page-container page-main flex flex-col';

export function PageMain({
  className = DEFAULT_CLASS,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={className} id={MAIN_CONTENT_ID} tabIndex={-1}>
      {children}
    </main>
  );
}
