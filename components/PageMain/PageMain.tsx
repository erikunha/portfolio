import type { ReactNode } from 'react';

export const MAIN_CONTENT_ID = 'main-content';

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
