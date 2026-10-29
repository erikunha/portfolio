import { z } from 'zod';
import { type HottestTake, HottestTakeSchema, TAKE_PLACEMENT } from './schemas';

export const hottestTakes: HottestTake[] = z.array(HottestTakeSchema).parse([
  {
    num: '01.',
    placement: TAKE_PLACEMENT.home,
    order: 1,
    category: 'ARCH',
    thesis: 'Angular is the right default for any regulated platform in 2026.',
    body: 'React\'s ecosystem moves faster but is less audit-friendly. NgRx + RxJS give you serializable state by default, that matters when a regulator subpoenas your deposit flow. The "Angular is slow" argument is a 2018 take that survived past its expiration date.',
  },
  {
    num: '02.',
    placement: TAKE_PLACEMENT.home,
    order: 2,
    category: 'MFE',
    thesis: 'Micro-frontends are a contract problem, not a routing problem.',
    body: "Most teams adopt them for Conway-shaped reasons (we have 4 teams, we want 4 apps) and pay the wrong tax. The hard part is event contracts and shared auth/state, not Module Federation config. If your MFEs can't be deployed independently without a runtime version matrix, you built a distributed monolith.",
  },
  {
    num: '03.',
    placement: TAKE_PLACEMENT.home,
    order: 3,
    category: 'TEST',
    thesis: 'The testing pyramid is wrong for B2C frontends.',
    body: 'Inverted pyramid: heavy E2E, lean units, near-zero shallow snapshots, wins when UX is the product. Unit tests catch refactors; E2E catches what the customer actually sees. On the Betsson cashier, Playwright and WireMock flows told me whether payments were at risk.',
  },
  {
    num: '07.',
    placement: TAKE_PLACEMENT.docs,
    order: 7,
    category: 'DS',
    thesis: 'Framework-agnostic design systems lose unless the contract is shipping, not theory.',
    body: `Web Components only pay off when you have >1 framework consuming them in production. Otherwise you bought distribution overhead to solve a problem you don't have. Stencil at Betsson worked because Angular, React, and Ember were all actually downstream — not because someone read a blog post.`,
  },
  {
    num: '09.',
    placement: TAKE_PLACEMENT.home,
    order: 4,
    category: 'AI',
    thesis: 'Spec-first is the only disciplined way to ship with LLMs and agents.',
    body: 'Vibe-coding generates output nobody can review. Spec-driven development inverts it: write the contract, expected behavior, and failure modes first, then the agent implements against a legible target. The spec is the review artifact, not the generated code. That is how I built the 12-agent Copilot system at Betsson: every automated action reviewable. Without the spec, you have a black box you cannot audit, cannot roll back, and cannot hand off.',
  },
]);

export const homeTakes = hottestTakes
  .filter((take) => take.placement === TAKE_PLACEMENT.home)
  .sort((left, right) => left.order - right.order);

const DESIGN_SYSTEM_CATEGORY = 'DS';

export const designSystemTake = hottestTakes.find(
  (take) => take.category === DESIGN_SYSTEM_CATEGORY && take.placement === TAKE_PLACEMENT.docs,
);

export const designSystemOpinionConfig = z
  .object({ topic: z.string().min(1) })
  .parse({ topic: 'design systems' });

export const hottestTakesConfig = z
  .object({
    header: z.string().min(1),
    command: z.string().min(1),
    preamble: z.string().min(1),
    footer: z.string().min(1),
  })
  .parse({
    header: 'CAT ~/HOTTEST_TAKES.MD',
    command: 'cat ~/hottest_takes.md',
    preamble: "// opinions i'll defend in a whiteboard interview",
    footer: 'willing to be wrong on any of these. willing to argue first.',
  });
