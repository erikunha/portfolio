import { z } from 'zod';

export const ReadmeCopySchema = z.object({
  desktopH1: z.string().min(1),
  desktopIntro: z.string().min(1),
  aboutTitle: z.string().min(1),
  aboutCommand: z.string().min(1),
  principlesHeading: z.string().min(1),
  responsibilitiesHeading: z.string().min(1),
  responsibilitiesCommand: z.string().min(1),
  responsibilitiesNote: z.string().min(1),
  desktopPrinciples: z.array(z.string().min(1)).min(1),
  desktopStatusH2: z.string().min(1),
  currentStatus: z.object({
    prefix: z.string().min(1),
    role: z.string().min(1),
    suffix: z.string().min(1),
  }),
  statusDetails: z.array(z.string().min(1)).min(1),
});
export type ReadmeCopy = z.infer<typeof ReadmeCopySchema>;

export const RetryCodeSchema = z.object({
  command: z.string().min(1),
  regionLabel: z.string().min(1),
  source: z.string().min(1),
  repoLabel: z.string().min(1),
  repoHref: z.string().url(),
});

export const readmeCopy: ReadmeCopy = ReadmeCopySchema.parse({
  desktopH1: '# Whoami',
  aboutTitle: 'ABOUT',
  aboutCommand: 'CAT README.MD',
  desktopIntro:
    '8+ years building production web software for regulated, high-traffic platforms: private-markets fintech, PCI-DSS payments, healthcare, retail e-commerce and bank insurance.',
  principlesHeading: '## Operating Principles',
  responsibilitiesHeading: 'LS -LA ~/RESPONSIBILITIES',
  responsibilitiesCommand: '$ ls -la ~/responsibilities',
  responsibilitiesNote: '// role boundaries, in unix terms',
  desktopPrinciples: [
    '- Performance-first: LCP, INP, CLS and bundle size in production budgets.',
    '- A11y & compliance: WCAG 2.2 AA, WAI-ARIA, PCI-DSS-grade safeguards.',
  ],
  desktopStatusH2: '## Current Status',
  currentStatus: {
    prefix: 'Open to ',
    role: 'Senior',
    suffix: ' roles or impactful contract roles · remote-first · EU/US/CA · English C1.',
  },
  statusDetails: [
    '- Level: Senior',
    '- Track: individual contributor or technical lead',
    '- Engagement: full-time or fixed-term contract',
    '- Domains: frontend, payments, healthcare, AI tooling',
  ],
});

const README_GUTTER_LINE_COUNT = 13;
const README_FIRST_LINE = 1;
export const readmeLineNumbers = Array.from(
  { length: README_GUTTER_LINE_COUNT },
  (_, index) => index + README_FIRST_LINE,
);

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

const RETRY_SYNTAX = {
  comment: /\/\/[^\n]*/,
  keyword: /\b(?:export|function|return|if|throw|const)\b/,
  type: /\b(?:RetryOpts|MonoTypeOperatorFunction|T)\b/,
  number: /\b\d+\b/,
  call: /\b(?:withRetry|retry|isFatal|Math\.random|timer)\b/,
};
let retryTokenOffset = 0;
export const retryTokens = retryCode.source
  .split(
    new RegExp(
      `(${Object.values(RETRY_SYNTAX)
        .map((pattern) => pattern.source)
        .join('|')})`,
      'g',
    ),
  )
  .filter(Boolean)
  .map((text) => {
    const offset = retryTokenOffset;
    retryTokenOffset += text.length;
    return {
      text,
      offset,
      kind: Object.entries(RETRY_SYNTAX).find(([, pattern]) => pattern.test(text))?.[0],
    };
  });
