import { type ReadmeCopy, ReadmeCopySchema } from './schemas';

export const readmeCopy: ReadmeCopy = ReadmeCopySchema.parse({
  desktopH1: '# Whoami',
  desktopIntro:
    'Brazilian 8+ years building frontend systems for regulated, high-traffic platforms in fintech (PCI-DSS), healthcare, global e-commerce, and AI-native B2B SaaS.',
  desktopCoreStack: [
    '- React · Next.js · TypeScript · Angular · RxJS · NgRx · Redux · Node.js · AWS ',
    '- Micro-frontends (MFE) · Nx monorepos ·  Web Core Vitals · Web Components · UX/UI · User Journeys',
  ],
  desktopPrinciples: [
    '- Performance-first: LCP, TBT, bundle reduction in production budgets.',
    '- A11y & compliance: WCAG 2.1 AA, ARIA, PCI-DSS-grade safeguards.',
  ],
  desktopStatusH2: '## Current Status',
});
