import { profileSummary } from './profile';
import { type ReadmeCopy, ReadmeCopySchema, RetryCodeSchema } from './schemas';
import { workAuthorizationSummary } from './visa';

export const readmeCopy: ReadmeCopy = ReadmeCopySchema.parse({
  desktopH1: '# Whoami',
  aboutTitle: 'About',
  desktopIntro: `${profileSummary} 8+ years building production web software for regulated, high-traffic platforms: private-markets fintech, PCI-DSS payments, healthcare, retail e-commerce and bank insurance. ${workAuthorizationSummary}.`,
  principlesHeading: '## Operating Principles',
  responsibilitiesHeading: 'LS -LA ~/RESPONSIBILITIES',
  responsibilitiesCommand: '$ ls -la ~/responsibilities',
  responsibilitiesNote: '// role boundaries, in unix terms',
  desktopPrinciples: [
    '- Performance-first: LCP, INP, CLS and bundle size in production budgets.',
    '- A11y & compliance: WCAG 2.2 AA, WAI-ARIA, PCI-DSS-grade safeguards.',
  ],
  desktopStatusH2: '## Current Status',
  currentStatus:
    'Open to Senior roles or impactful contract roles · remote-first · EU/US/CA · English C1.',
  statusDetails: [
    '- Level: Senior',
    '- Track: individual contributor or technical lead',
    '- Engagement: full-time or fixed-term contract',
    '- Domains: frontend, payments, healthcare, AI tooling',
  ],
});

export const retryCode = RetryCodeSchema.parse({
  command: '$ cat src/lib/with-retry.ts',
  regionLabel: 'README code',
  repoLabel: '// view full repo →',
  repoHref: 'https://github.com/erikunha',
  source: `// retry an RxJS stream with exponential backoff + jitter, used in
// the cashier's deposit polling loop. signals abort on permanent 4xx.
export function withRetry<T>(
  { max = 5, base = 300, isFatal }: RetryOpts,
): MonoTypeOperatorFunction<T> {
  return retry({
    count: max,
    delay: (err, attempt) => {
      if (isFatal?.(err)) throw err;
      const wait = base * 2 ** attempt + Math.random() * base;
      return timer(wait);
    },
  });
}`,
});
