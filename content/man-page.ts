import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'full-stack engineer (frontend-heavy)',
  version: 'v8.0',
  date: '2026-05-15',
  description:
    'Senior frontend engineer, 8+ years. Shipped production systems across payments (PCI-DSS), healthcare, e-commerce, and ed-tech. Angular, React/Next.js, Stencil micro-frontends powering €1B+ in revenue. 12-agent AI platform in production. Currently at Betsson (Malta, EU).',
  options: [
    { flag: '--seniority', desc: 'Senior → Staff/Principal' },
    { flag: '--track', desc: 'IC or technical lead' },
    { flag: '--domain', desc: 'Payments, healthcare, AI tooling' },
    { flag: '--region', desc: 'Worldwide; remote-first' },
    { flag: '--relocation', desc: 'Open to relocating' },
    { flag: '--regulated', desc: 'PCI-DSS, healthcare, banking' },
    { flag: '--contract', desc: 'Fixed-term or freelance' },
    { flag: '--ft', desc: 'Full-time' },
    { flag: '--hire', desc: 'Initiates handshake. See CONTACT.' },
  ],
  knownBugs: [
    'Occasionally rewrites a working component for clarity.',
    'Will not stop talking about bundle size.',
    'Sometimes ships the test before the feature.',
  ],
});
