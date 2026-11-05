import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'full-stack engineer (frontend-heavy)',
  version: 'v9.0',
  date: '2026-11-05',
  description:
    'Senior full-stack engineer (frontend-heavy), 8+ years.\n       Shipped production systems across payments (PCI-DSS), healthcare,\n       and e-commerce. React/Next.js, Angular, Stencil micro-frontends\n       across 15+ regulated markets, €1.2B group revenue. Spec-driven 12-agent\n       AI platform shipped at Betsson. Last: shared UI systems for AI\n       deal origination, Raylu.ai (contract via Torc, 2026). Open to roles.',
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
