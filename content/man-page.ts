import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'full-stack engineer (frontend-heavy)',
  version: 'v9.0',
  date: '2026-07-11',
  description:
    'Senior frontend engineer, 8+ years. Shipped production systems across\n       payments (PCI-DSS), healthcare, and e-commerce. Angular, React/Next.js,\n       Stencil micro-frontends across 15+ regulated markets, €1B+ revenue.\n       Spec-driven 12-agent AI platform shipped at Betsson. Now: frontend\n       platform for AI deal origination, Raylu.ai (remote).',
  options: [
    { flag: '--seniority', desc: 'Senior → Staff/Principal' },
    { flag: '--track', desc: 'IC or technical lead' },
    { flag: '--domain', desc: 'Frontend, payments, healthcare, AI tooling, e-commerce' },
    { flag: '--region', desc: 'Worldwide; remote-first' },
    { flag: '--relocation', desc: 'Open to relocating' },
    { flag: '--regulated', desc: 'PCI-DSS, healthcare, banking' },
    { flag: '--contract', desc: 'Fixed-term or freelance' },
    { flag: '--ft', desc: 'Full-time' },
    { flag: '--hire', desc: 'Initiates handshake. See CONTACT.' },
  ],
  knownBugs: [
    'Has more side-project ideas than free weekends.',
    'Falls down a documentation rabbit hole most days.',
    'Gets quietly nerd-sniped by an interesting problem.',
  ],
});
