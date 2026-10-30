import type { ReactNode } from 'react';

export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="page-container flex flex-col relative z-10" id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
