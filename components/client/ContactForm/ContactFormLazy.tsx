'use client';

import dynamic from 'next/dynamic';

export const ContactFormLazy = dynamic(
  () => import('./ContactForm').then((m) => ({ default: m.ContactForm })),
  {
    ssr: false,
    loading: () => (
      <div className="contact" role="status" aria-busy="true" aria-label="Loading contact form" />
    ),
  },
);
