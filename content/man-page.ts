import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'full-stack engineer (frontend-heavy)',
  version: 'v8.0',
  date: '2026-05-15',
  descriptionMobile: 'Senior frontend engineer, 8+ years. Shipped production systems across payments (PCI-DSS), healthcare, e-commerce, and ed-tech. Angular, React/Next.js, Stencil micro-frontends powering €1B+ in revenue. 12-agent AI platform in production. Currently at Betsson (Malta, EU).',
});
