import { z } from 'zod';
import { type HottestTake, HottestTakeSchema } from './schemas';

export const hottestTakes: HottestTake[] = z.array(HottestTakeSchema).parse([
  {
    num: '01.',
    category: 'ARCH',
    thesis: 'Angular is the right default for any regulated platform in 2026.',
    body: `React's ecosystem moves faster but is less audit-friendly. NgRx + RxJS give you serializable state by default — that matters when a regulator subpoenas your deposit flow. The "Angular is slow" argument is a 2018 take that survived past its expiration date.`,
  },
  {
    num: '02.',
    category: 'MFE',
    thesis: 'Micro-frontends are a contract problem, not a routing problem.',
    body: `Most teams adopt them for Conway-shaped reasons (we have 4 teams, we want 4 apps) and pay the wrong tax. The hard part is event contracts and shared auth/state — not Module Federation config. If your MFEs can't be deployed independently without a runtime version matrix, you built a distributed monolith.`,
  },
  {
    num: '03.',
    category: 'TEST',
    thesis: 'The testing pyramid is wrong for B2C frontends.',
    body: 'Inverted pyramid — heavy E2E, lean units, near-zero shallow snapshots — wins when UX is the product. Unit tests catch refactors; E2E catches what the customer actually sees. On the Betsson cashier, a single Playwright trace replaced 40 brittle component tests and told me whether revenue was at risk.',
  },
  {
    num: '04.',
    category: 'AI',
    thesis:
      'AI code review is already better than 80% of human reviewers for style and local correctness.',
    body: `The remaining 20% — cross-system reasoning, "why is this here", judging trade-offs against constraints reviewers were never told about — is exactly what senior humans are for. Hiring should optimize for that, not for catching missing semicolons your CI also caught.`,
  },
  {
    num: '05.',
    category: 'SIGNAL',
    thesis: 'Bundle size is a leading indicator of team health, not a tech metric.',
    body: `A team that ignores the 1.4MB main chunk also ignores the dead route, the four versions of lodash, and the on-call rotation. The number itself doesn't cost much; what it predicts about discipline does. -33% JS at Canon Medical was the cheapest culture audit I've ever run.`,
  },
  {
    num: '06.',
    category: 'DX',
    thesis: `RxJS isn't harder than promises. It's harder than the wrong abstraction you reach for instead.`,
    body: `Most "just use async/await" code is a hand-rolled, buggy reimplementation of switchMap + retry + takeUntil. Pay the learning curve once; stop reinventing cancellation, backpressure, and race conditions per-feature for the rest of your career.`,
  },
  {
    num: '07.',
    category: 'DS',
    thesis: 'Framework-agnostic design systems lose unless the contract is shipping, not theory.',
    body: `Web Components only pay off when you have >1 framework consuming them in production. Otherwise you bought distribution overhead to solve a problem you don't have. Stencil at Betsson worked because Angular, React, and Ember were all actually downstream — not because someone read a blog post.`,
  },
  {
    num: '08.',
    category: 'PROC',
    thesis: 'If your PRs require a meeting to merge, your architecture is unwritten.',
    body: `Architecture lives in the code review template, the ADR folder, and the linter config — not in a Confluence page nobody opens. The 35-page architecture system at Betsson cut onboarding -40% because it replaced "ask Erik" with "ask the doc". The doc doesn't go on PTO.`,
  },
  {
    num: '09.',
    category: 'AI',
    thesis: 'Spec-first is the only disciplined way to ship with LLMs and agents.',
    body: 'Vibe-coding generates output nobody can review. Spec-driven development inverts it: write the contract, expected behavior, and failure modes first — then the agent implements against a legible target. The spec is the review artifact, not the generated code. That is how I ran the 12-agent Copilot system at Betsson: every agent gated on a written spec before touching a file. Without the spec, you have a black box you cannot audit, cannot roll back, and cannot hand off.',
  },
]);

export const hottestTakesConfig = {
  preamble: "// opinions i'll defend in a whiteboard interview",
  footer: 'willing to be wrong on any of these. willing to argue first.',
} as const;
