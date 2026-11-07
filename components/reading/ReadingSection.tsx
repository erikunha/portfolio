import type { ReactNode } from 'react';

export function ReadingSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="reading-section">
      <h2 id={id} className="reading-heading" data-type-reveal suppressHydrationWarning>
        {heading}
      </h2>
      {children}
    </section>
  );
}
