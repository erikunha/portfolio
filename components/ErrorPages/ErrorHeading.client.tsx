'use client';

import { type ReactNode, useEffect, useRef } from 'react';

export function ErrorHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} className="err-h1" tabIndex={-1}>
      {children}
    </h1>
  );
}
