import { type ReadmeCopy, ReadmeCopySchema } from './schemas';

export const readmeCopy: ReadmeCopy = ReadmeCopySchema.parse({
  desktopH1: '# Whoami',
  desktopIntro:
    'Brazilian 8+ years building frontend systems for regulated, high-traffic platforms in fintech (PCI-DSS), healthcare, and global e-commerce.',
  desktopCoreStack: [
    '- Angular · React · Next.js · TypeScript · RxJS · NgRx · Redux · Node.js · AWS ',
    '- Micro-frontends (MFE) · Nx monorepos ·  Web Core VItals · Web Components · UX/UI · User Journeys',
  ],
  desktopPrinciples: [
    '- Performance-first: LCP, TBT, bundle reduction in production budgets.',
    '- A11y & compliance: WCAG 2.1 AA, ARIA, PCI-DSS-grade safeguards.',
  ],
  desktopStatusH2: '## Current Status',
  mobileH2: '# erik cunha',
  mobileBetssonPrefix: 'shipping the ',
  mobileBetssonSuffix: 'PCI-DSS, micro-frontends, €1B+ annual revenue.',
  mobileCoreStack: [
    '- Angular · React/Next.js · TypeScript · Node.js · RxJS',
    '- Micro-frontends · Nx · Clean Architecture',
  ],
  mobilePrinciples: [
    '- Performance-first: LCP, TBT, bundle reduction in prod.',
    '- A11y & compliance: WCAG 2.1 AA, PCI-DSS.',
  ],
  mobileStatusSuffix: 'remote-first · EU/US/CA · English C1.',
});
