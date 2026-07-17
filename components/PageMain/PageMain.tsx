import type { ReactNode } from 'react';

export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex flex-col relative z-10 max-w-[1200px] mx-auto px-6 pt-[60px] max-[900px]:px-[18px] max-[900px]:pt-5 max-md:px-6 max-md:pt-3.5"
      id="main-content"
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
