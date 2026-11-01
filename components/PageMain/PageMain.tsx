import type { ReactNode } from 'react';

export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="page-container page-main flex flex-col" id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
