# Guitar Rig Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing plain-text `pre` block in GuitarSection with a terminal-aesthetic signal-chain UI. 100% RSC, zero client JS, new content schema.

**Architecture:** RSC-only section — `GuitarDesktop` and `GuitarMobile` sub-components in one file, UA dispatch via `getIsMobile()` in `GuitarContent`, wrapped in `<Module>`. Photo served via `next/image`. Content driven entirely from `content/guitar-rig.ts` with a new Zod schema.

**Tech Stack:** Next.js 16 RSC, CSS Modules, Zod, `sips` for image processing, `next/image`, `@testing-library/react` + `renderToStaticMarkup` for tests.

---

### Task 1: Copy and optimize the guitar photo

**Files:**
- Create: `public/images/guitar-live.jpg`

- [ ] **Step 1: Resize and copy photo**

```bash
mkdir -p public/images
sips -Z 600 ~/Downloads/me_playing_guitar.jpg --out public/images/guitar-live.jpg
```

Expected: `public/images/guitar-live.jpg` created, size < 40KB.

- [ ] **Step 2: Verify dimensions and size**

```bash
sips -g pixelHeight -g pixelWidth public/images/guitar-live.jpg && wc -c public/images/guitar-live.jpg
```

Expected output: `pixelHeight: 600` (or similar), `pixelWidth: 600`, size < 41000 bytes.

- [ ] **Step 3: Commit photo**

```bash
git add public/images/guitar-live.jpg
git commit -m "feat(guitar): add optimized live stage photo"
```

---

### Task 2: Replace GuitarRigSchema in content/schemas.ts

**Files:**
- Modify: `content/schemas.ts:68-88` — replace old `GuitarFieldSchema`, `GuitarInfluenceSchema`, `GuitarRigSchema` and the exported `GuitarRig` type on line 199.

- [ ] **Step 1: Write a failing schema validation test**

Create `content/schemas.test.ts` (append to existing if file exists, else create):

```typescript
// Failing test — GuitarRigSchema v2 not yet defined
import { describe, expect, it } from 'vitest';

describe('GuitarRigSchema v2', () => {
  it('rejects old flat-fields shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({ fields: [], influences: [], influencesMobile: [] })
    ).toThrow();
  });

  it('accepts new signalChain + influences + stats shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({
        signalChain: [
          { role: 'INPUT', name: 'TEST', subtitle: 'sub', strengthDots: 4 },
          { role: 'FX',    name: 'FX',   subtitle: 'sub', blocks: [{ name: 'COMP', active: true }] },
          { role: 'AMP',   name: 'AMP',  subtitle: 'sub', strengthDots: 3 },
          { role: 'OUT',   name: 'OUT',  subtitle: 'sub', strengthDots: 5 },
        ],
        influences: [
          { rank: 1, name: 'A', strength: 5, active: true },
          { rank: 2, name: 'B', strength: 4 },
          { rank: 3, name: 'C', strength: 3 },
          { rank: 4, name: 'D', strength: 3 },
          { rank: 5, name: 'E', strength: 2 },
        ],
        nowObsessing: 'some song',
        stats: [
          { label: 'STYLE',   value: 'feel',     sub: 'lots' },
          { label: 'TUNING',  value: 'standard', sub: 'drop D' },
          { label: 'ALT RIG', value: 'Martin',   sub: 'acoustic' },
          { label: 'GIGS',    value: 'small',    sub: 'band' },
        ],
        liveCam: { photo: '/images/guitar-live.jpg', caption: './GIGS' },
      })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pnpm test --run content/schemas.test.ts 2>&1 | tail -15
```

Expected: 1 test passing (rejects old shape), 1 failing (new shape not yet accepted — schema still old).

- [ ] **Step 3: Replace the Guitar schema section in schemas.ts**

In `content/schemas.ts`, replace lines 68–88 (the `GuitarFieldSchema`, `GuitarInfluenceSchema`, and old `GuitarRigSchema`) with:

```typescript
// GuitarSection v2 — signal chain + influences + stats + live cam
export const SignalChainNodeSchema = z.object({
  role: z.enum(['INPUT', 'FX', 'AMP', 'OUT']),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  strengthDots: z.number().int().min(0).max(8).optional(),
  blocks: z
    .array(z.object({ name: z.string().min(1), active: z.boolean() }))
    .optional(),
});

export const InfluenceSchema = z.object({
  rank: z.number().int().min(1).max(5),
  name: z.string().min(1),
  strength: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]),
  active: z.boolean().optional(),
});

export const StatCellSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  sub: z.string().min(1),
});

export const GuitarRigSchema = z.object({
  signalChain: z.array(SignalChainNodeSchema).length(4),
  influences: z.array(InfluenceSchema).length(5),
  nowObsessing: z.string().min(1),
  stats: z.array(StatCellSchema).length(4),
  liveCam: z.object({
    photo: z.string().min(1),
    caption: z.string().min(1),
  }),
});
```

Also replace line 199 (`export type GuitarRig = z.infer<typeof GuitarRigSchema>;`) — keep exactly as-is, it still works with the new schema.

Remove the old exported types `GuitarField` and `GuitarInfluence` if they exist in the exported types block.

- [ ] **Step 4: Run test to confirm both pass**

```bash
pnpm test --run content/schemas.test.ts 2>&1 | tail -10
```

Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add content/schemas.ts content/schemas.test.ts
git commit -m "feat(guitar): replace GuitarRigSchema with v2 signal-chain schema"
```

---

### Task 3: Rewrite content/guitar-rig.ts

**Files:**
- Modify: `content/guitar-rig.ts` — full replacement.

- [ ] **Step 1: Run validate-content to confirm it fails (old content, new schema)**

```bash
pnpm validate-content 2>&1 | grep -E "guitar|PASS|FAIL"
```

Expected: `content/guitar-rig.ts — FAIL` (old data shape rejected by new schema).

- [ ] **Step 2: Rewrite guitar-rig.ts**

```typescript
import { type GuitarRig, GuitarRigSchema } from './schemas';

export const guitarRig: GuitarRig = GuitarRigSchema.parse({
  signalChain: [
    {
      role: 'INPUT',
      name: 'GRETSCH G5655TG',
      subtitle: 'Bigsby · hollow body',
      strengthDots: 4,
    },
    {
      role: 'FX',
      name: 'LINE 6 HX STOMP XL',
      subtitle: '8 blocks loaded',
      blocks: [
        { name: 'COMP', active: true  },
        { name: 'OD',   active: true  },
        { name: 'FUZZ', active: false },
        { name: 'DLY',  active: true  },
        { name: 'REV',  active: true  },
        { name: 'MOD',  active: false },
        { name: 'EQ',   active: true  },
        { name: 'VOL',  active: false },
      ],
    },
    {
      role: 'AMP',
      name: 'MODELED CAB',
      subtitle: 'no tube · IR sim',
      strengthDots: 3,
    },
    {
      role: 'OUT',
      name: 'FOH / IEM',
      subtitle: 'XLR stereo · in-ear',
      strengthDots: 5,
    },
  ],
  influences: [
    { rank: 1, name: 'John Mayer',          strength: 5, active: true },
    { rank: 2, name: 'Mateus Asato',        strength: 4 },
    { rank: 3, name: 'Jimmy Page',          strength: 3 },
    { rank: 4, name: 'John Frusciante',     strength: 3 },
    { rank: 5, name: "Iron Maiden's three", strength: 2 },
  ],
  nowObsessing: "Coldplay's \"Yellow\" — simplicity is hard.",
  stats: [
    { label: 'STYLE',   value: 'feel over noise', sub: 'lots of space'    },
    { label: 'TUNING',  value: 'standard E',      sub: 'sometimes drop D' },
    { label: 'ALT RIG', value: 'Martin',           sub: 'acoustic'         },
    { label: 'GIGS',    value: 'small venues',     sub: 'band setting'     },
  ],
  liveCam: {
    photo: '/images/guitar-live.jpg',
    caption: './GIGS --LIVE · SMALL VENUES · FEEL OVER NOISE',
  },
});
```

- [ ] **Step 3: Run validate-content to confirm it now passes**

```bash
pnpm validate-content 2>&1 | grep -E "guitar|PASS|FAIL"
```

Expected: `content/guitar-rig.ts — PASS`.

- [ ] **Step 4: Commit**

```bash
git add content/guitar-rig.ts
git commit -m "feat(guitar): rewrite guitar-rig.ts for signal-chain schema v2"
```

---

### Task 4: Write failing GuitarSection tests

**Files:**
- Create: `components/sections/GuitarSection/GuitarSection.test.tsx`

- [ ] **Step 1: Create test file with failing tests**

```tsx
// components/sections/GuitarSection/GuitarSection.test.tsx
// Behavioral tests: renders signal chain, influences, stats, live cam.
// Both desktop and mobile variants tested via the sub-components directly
// (avoids getIsMobile() async UA branch in test env).

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// next/image in test env needs a minimal stub (no srcset resolution)
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement('img', { src, alt }),
}));

async function renderDesktop(): Promise<Document> {
  const { GuitarDesktop } = await import('./GuitarSection');
  const html = renderToStaticMarkup(createElement(GuitarDesktop));
  return new DOMParser().parseFromString(html, 'text/html');
}

async function renderMobile(): Promise<Document> {
  const { GuitarMobile } = await import('./GuitarSection');
  const html = renderToStaticMarkup(createElement(GuitarMobile));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('GuitarSection — signal chain (desktop)', () => {
  it('renders all 4 signal chain nodes', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="signal-node-"]').length).toBe(4);
  });

  it('renders INPUT, FX, AMP, OUT nodes', async () => {
    const doc = await renderDesktop();
    for (const role of ['INPUT', 'FX', 'AMP', 'OUT']) {
      expect(doc.querySelector(`[data-testid="signal-node-${role}"]`)).not.toBeNull();
    }
  });

  it('FX node renders 8 blocks (5 active, 3 inactive)', async () => {
    const doc = await renderDesktop();
    const fxNode = doc.querySelector('[data-testid="signal-node-FX"]');
    expect(fxNode).not.toBeNull();
    // Active blocks contain a bullet span
    const bullets = fxNode?.querySelectorAll('[aria-hidden="true"]');
    expect(bullets?.length).toBe(5);
  });

  it('INPUT node shows 4 strength dots', async () => {
    const doc = await renderDesktop();
    const inputNode = doc.querySelector('[data-testid="signal-node-INPUT"]');
    // aria-label "4 of 8" on the dots container
    expect(inputNode?.querySelector('[aria-label="4 of 8"]')).not.toBeNull();
  });
});

describe('GuitarSection — influences (desktop)', () => {
  it('renders INFLUENCES.QUEUE header with 5 loaded', async () => {
    const doc = await renderDesktop();
    expect(doc.body.textContent).toContain('INFLUENCES.QUEUE · 5 LOADED');
  });

  it('renders John Mayer as the active (▶) influence', async () => {
    const doc = await renderDesktop();
    const active = doc.querySelector('[data-testid="guitar-desktop"] [class*="infActive"]');
    expect(active?.textContent).toContain('John Mayer');
  });

  it('renders now obsessing text', async () => {
    const doc = await renderDesktop();
    expect(doc.body.textContent).toContain('simplicity is hard');
  });
});

describe('GuitarSection — stats grid (desktop)', () => {
  it('renders 4 stat cells', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="stat-"]').length).toBe(4);
  });

  it('stat labels are STYLE, TUNING, ALT RIG, GIGS', async () => {
    const doc = await renderDesktop();
    for (const label of ['STYLE', 'TUNING', 'ALT RIG', 'GIGS']) {
      expect(doc.querySelector(`[data-testid="stat-${label}"]`)).not.toBeNull();
    }
  });
});

describe('GuitarSection — live cam (desktop)', () => {
  it('renders image with descriptive alt text', async () => {
    const doc = await renderDesktop();
    const img = doc.querySelector('img');
    expect(img?.getAttribute('alt')).toContain('Erik playing guitar');
  });

  it('renders the gig caption', async () => {
    const doc = await renderDesktop();
    expect(doc.body.textContent).toContain('FEEL OVER NOISE');
  });
});

describe('GuitarSection — mobile layout', () => {
  it('renders all 4 signal chain nodes on mobile', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="signal-node-mobile-"]').length).toBe(4);
  });

  it('FX node renders blocks as a list (not a grid)', async () => {
    const doc = await renderMobile();
    const fxNode = doc.querySelector('[data-testid="signal-node-mobile-FX"]');
    expect(fxNode).not.toBeNull();
    // fxList class present — full-width rows instead of grid
    const list = fxNode?.querySelector('[class*="fxList"]');
    expect(list).not.toBeNull();
  });

  it('mobile stats renders 4 cells in a 2x2 grid', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="stat-mobile-"]').length).toBe(4);
  });
});

describe('GuitarSection — XSS safety', () => {
  it('does not use dangerouslySetInnerHTML in the section', async () => {
    // Verify no dangerous HTML is used — the component file must not contain
    // the string dangerouslySetInnerHTML since content contains user-controlled text.
    const fs = await import('node:fs');
    const src = fs.readFileSync('components/sections/GuitarSection/GuitarSection.tsx', 'utf8');
    expect(src).not.toContain('dangerouslySetInnerHTML');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (GuitarSection not yet rewritten)**

```bash
pnpm test --run GuitarSection.test.tsx 2>&1 | tail -15
```

Expected: multiple test failures (components don't export GuitarDesktop/GuitarMobile yet, or render wrong content).

---

### Task 5: Rewrite GuitarSection.tsx

**Files:**
- Modify: `components/sections/GuitarSection/GuitarSection.tsx` — full replacement.

- [ ] **Step 1: Replace GuitarSection.tsx**

```tsx
import Image from 'next/image';
import { Suspense } from 'react';
import type { GuitarRig } from '@/content/schemas';
import { guitarRig } from '@/content/guitar-rig';
import { getIsMobile } from '@/lib/ua';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';
import s from './GuitarSection.module.css';

type Block = NonNullable<GuitarRig['signalChain'][number]['blocks']>[number];
type Influence = GuitarRig['influences'][number];

// Parses **bold** markers to <strong> without dangerouslySetInnerHTML.
// Odd-indexed parts (between ** pairs) become <strong>.
function ParsedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </>
  );
}

function StrengthDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className={s.dots} aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? s.dotFilled : s.dotEmpty} />
      ))}
    </div>
  );
}

function FxGrid({ blocks }: { blocks: Block[] }) {
  return (
    <div className={s.fxGrid}>
      {blocks.map((b) => (
        <div key={b.name} className={b.active ? s.fxActive : s.fxInactive}>
          {b.name}
          {b.active && <span className={s.fxBullet} aria-hidden="true">●</span>}
        </div>
      ))}
    </div>
  );
}

function FxList({ blocks }: { blocks: Block[] }) {
  return (
    <div className={s.fxList}>
      {blocks.map((b) => (
        <div key={b.name} className={b.active ? s.fxRowActive : s.fxRowInactive}>
          <span aria-hidden="true">{b.active ? '●' : '○'}</span>
          <span>{b.name}</span>
        </div>
      ))}
    </div>
  );
}

function InfluencesList({ influences, nowObsessing }: {
  influences: Influence[];
  nowObsessing: string;
}) {
  return (
    <div className={s.influences}>
      <div className={s.influencesHeader}>
        <span>INFLUENCES.QUEUE · {influences.length} LOADED</span>
        <span>// SHUFFLE OFF</span>
      </div>
      {influences.map((inf) => (
        <div key={inf.rank} className={inf.active ? s.infActive : s.infItem}>
          <span className={s.infName}>
            <span aria-hidden="true">{inf.active ? '▶' : '  '}</span>
            {String(inf.rank).padStart(2, '0')}{'  '}{inf.name}
          </span>
          <StrengthDots filled={inf.strength} total={5} />
        </div>
      ))}
      <div className={s.nowObsessing}>
        <strong>now obsessing:</strong> {nowObsessing}
      </div>
    </div>
  );
}

function LiveCam({ liveCam }: { liveCam: GuitarRig['liveCam'] }) {
  return (
    <div className={s.liveCam}>
      <div className={s.camHeader}>
        <span>▶ REC · LIVE</span>
        <span>CAM/01 · STAGE</span>
      </div>
      <div className={s.camPhoto}>
        <Image
          src={liveCam.photo}
          alt="Erik playing guitar on stage, live show"
          fill
          className={s.camImg}
          sizes="(max-width: 768px) 100vw, 220px"
        />
        <div className={s.camOverlay} aria-hidden="true" />
        <div className={s.scanLines} aria-hidden="true" />
        <div className={s.scanBeam} aria-hidden="true" />
      </div>
      <div className={s.camCaption}>{liveCam.caption}</div>
    </div>
  );
}

export function GuitarDesktop() {
  const { signalChain, influences, nowObsessing, stats, liveCam } = guitarRig;
  return (
    <div className={s.root} data-testid="guitar-desktop">
      <div className={s.panel}>
        <div className={s.statusBar}>
          <span>
            <span className={s.statusDot} aria-hidden="true">●</span>
            {' SIGNAL_CHAIN.LIVE · SIGNAL OK'}
          </span>
          <span>TAIL -F ~/.RIG</span>
        </div>
        <div className={s.chainGrid}>
          {signalChain.map((node, i) => (
            <div key={node.role} className={s.chainEntry}>
              {i > 0 && (
                <span className={s.arrow} aria-hidden="true">→</span>
              )}
              <div
                className={node.role === 'FX' ? s.nodeFx : s.node}
                data-testid={`signal-node-${node.role}`}
              >
                <div className={s.nodeLabel}>// {node.role}</div>
                <div className={s.nodeName}>{node.name}</div>
                <div className={s.nodeSub}>{node.subtitle}</div>
                {node.blocks ? (
                  <FxGrid blocks={node.blocks} />
                ) : (
                  <StrengthDots filled={node.strengthDots ?? 0} total={8} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={s.twoCol}>
        <InfluencesList influences={influences} nowObsessing={nowObsessing} />
        <LiveCam liveCam={liveCam} />
      </div>
      <div className={s.statsGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={s.statCell} data-testid={`stat-${stat.label}`}>
            <div className={s.statLabel}>// {stat.label}</div>
            <div className={s.statValue}>{stat.value}</div>
            <div className={s.statSub}>{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuitarMobile() {
  const { signalChain, influences, nowObsessing, stats, liveCam } = guitarRig;
  return (
    <div className={s.rootMobile} data-testid="guitar-mobile">
      <div className={s.panelMobile}>
        <div className={s.statusBarMobile}>
          <div>
            <span className={s.statusDot} aria-hidden="true">●</span>
            {' SIGNAL_CHAIN.LIVE · SIGNAL OK'}
          </div>
          <div>TAIL -F ~/.RIG</div>
        </div>
        {signalChain.map((node, i) => (
          <div key={node.role}>
            {i > 0 && (
              <div className={s.arrowDown} aria-hidden="true">▼</div>
            )}
            <div className={s.nodeMobile} data-testid={`signal-node-mobile-${node.role}`}>
              <div className={s.nodeLabel}>// {node.role}</div>
              <div className={s.nodeName}>{node.name}</div>
              <div className={s.nodeSub}>{node.subtitle}</div>
              {node.blocks ? (
                <FxList blocks={node.blocks} />
              ) : (
                <StrengthDots filled={node.strengthDots ?? 0} total={8} />
              )}
            </div>
          </div>
        ))}
      </div>
      <InfluencesList influences={influences} nowObsessing={nowObsessing} />
      <LiveCam liveCam={liveCam} />
      <div className={s.statsGridMobile}>
        {stats.map((stat) => (
          <div key={stat.label} className={s.statCell} data-testid={`stat-mobile-${stat.label}`}>
            <div className={s.statLabel}>// {stat.label}</div>
            <div className={s.statValue}>{stat.value}</div>
            <div className={s.statSub}>{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function GuitarContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <GuitarMobile /> : <GuitarDesktop />;
}

export function GuitarSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-guitar" header="CAT ~/.GUITAR_RIG" icon={<IconGuitar />} defer={defer}>
      <Suspense fallback={<GuitarDesktop />}>
        <GuitarContent />
      </Suspense>
    </Module>
  );
}
```

---

### Task 6: Rewrite GuitarSection.module.css

**Files:**
- Modify: `components/sections/GuitarSection/GuitarSection.module.css` — full replacement.

- [ ] **Step 1: Replace GuitarSection.module.css**

```css
/* ── GuitarSection v2 (signal chain terminal aesthetic) ──────────────── */

/* ─── Shared ─────────────────────────────────────────────────────────── */
.nodeLabel {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  letter-spacing: 0.04em;
  margin-bottom: 3px;
}
.nodeName {
  font-weight: 700;
  font-size: var(--ds-font-size-sm);
  color: var(--ds-color-signal);
  margin-bottom: 2px;
}
.nodeSub {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  margin-bottom: 8px;
}
.dots {
  display: flex;
  gap: 3px;
  margin-top: 4px;
}
.dotFilled {
  width: 8px;
  height: 8px;
  background: var(--ds-color-signal);
  flex-shrink: 0;
}
.dotEmpty {
  width: 8px;
  height: 8px;
  background: var(--ds-color-signal-quiet);
  flex-shrink: 0;
}
.statCell {
  padding: 10px 12px;
}
.statLabel {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  letter-spacing: 0.04em;
  margin-bottom: 3px;
}
.statValue {
  font-weight: 700;
  color: var(--ds-color-signal);
  font-size: var(--ds-font-size-sm);
  margin-bottom: 2px;
}
.statSub {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
}

/* ─── Live cam (shared desktop + mobile) ──────────────────────────────── */
.liveCam {
  border: 1px solid var(--ds-color-border-default);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.camHeader {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  background: var(--ds-color-surface-shell);
}
.camPhoto {
  position: relative;
  min-height: 130px;
  overflow: hidden;
  flex: 1;
}
.camImg {
  object-fit: cover;
  filter: grayscale(1) brightness(0.45);
}
.camOverlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 255, 65, 0.12);
  mix-blend-mode: screen;
  pointer-events: none;
}
.scanLines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.22) 2px,
    rgba(0, 0, 0, 0.22) 4px
  );
  pointer-events: none;
}
.scanBeam {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0, 255, 65, 0.3);
  pointer-events: none;
  animation: scanBeam 4s linear infinite;
  top: 0;
}
@media (prefers-reduced-motion: reduce) {
  .scanBeam { animation: none; }
}
@keyframes scanBeam {
  from { top: 0; }
  to   { top: 100%; }
}
.camCaption {
  padding: 4px 8px;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  background: var(--ds-color-surface-shell);
}

/* ─── Influences (shared desktop + mobile) ─────────────────────────────── */
.influences {
  border: 1px solid var(--ds-color-border-default);
  padding: 12px;
}
.influencesHeader {
  display: flex;
  justify-content: space-between;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.infActive {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  color: var(--ds-color-signal);
  font-weight: 700;
  font-size: var(--ds-font-size-xs);
}
.infItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  color: var(--ds-color-text-muted);
  font-size: var(--ds-font-size-xs);
}
.infName {
  flex: 1;
  margin-right: 8px;
  font-family: var(--ds-font-family-mono);
}
.nowObsessing {
  margin-top: 10px;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-signal);
  line-height: 1.6;
}

/* ─── Desktop ──────────────────────────────────────────────────────────── */
.root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-body);
  color: var(--ds-color-text-body);
}
.panel {
  border: 1px solid var(--ds-color-border-default);
  padding: 12px;
}
.statusBar {
  display: flex;
  justify-content: space-between;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  margin-bottom: 12px;
}
.statusDot {
  color: var(--ds-color-signal);
}
/* Signal chain: flex row — each entry has optional arrow + node */
.chainGrid {
  display: flex;
  align-items: stretch;
}
.chainEntry {
  display: flex;
  align-items: stretch;
  flex: 1;
}
.chainEntry:nth-child(n+2) {
  /* The FX entry (index 1 after arrow) is wider */
}
.arrow {
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: var(--ds-color-text-muted);
  flex-shrink: 0;
}
.node {
  border: 1px solid var(--ds-color-border-default);
  padding: 10px 12px;
  flex: 1;
  min-width: 0;
}
.nodeFx {
  border: 1px solid var(--ds-color-border-default);
  padding: 10px 12px;
  flex: 1.6;
  min-width: 0;
}
/* FX grid: 2 rows × 4 cols */
.fxGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 6px;
}
.fxActive {
  border: 1px solid var(--ds-color-border-default);
  padding: 3px 4px;
  font-size: var(--ds-font-size-2xs);
  text-align: center;
  position: relative;
  color: var(--ds-color-signal);
}
.fxInactive {
  border: 1px solid var(--ds-color-signal-quiet);
  padding: 3px 4px;
  font-size: var(--ds-font-size-2xs);
  text-align: center;
  color: var(--ds-color-text-muted);
}
.fxBullet {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 7px;
  line-height: 1;
  color: var(--ds-color-signal);
}
/* Two-column row */
.twoCol {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 12px;
}
/* Stats grid: 4 equal columns, outer border, internal right borders */
.statsGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--ds-color-border-default);
}
.statsGrid .statCell {
  border-right: 1px solid var(--ds-color-border-default);
}
.statsGrid .statCell:last-child {
  border-right: none;
}

/* ─── Mobile ────────────────────────────────────────────────────────────── */
.rootMobile {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-sm);
  color: var(--ds-color-text-body);
}
.panelMobile {
  border: 1px solid var(--ds-color-border-default);
  padding: 10px;
}
.statusBarMobile {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  margin-bottom: 10px;
  line-height: 1.7;
}
.nodeMobile {
  border: 1px solid var(--ds-color-border-default);
  padding: 10px;
}
.arrowDown {
  text-align: center;
  padding: 5px 0;
  color: var(--ds-color-text-muted);
  font-size: var(--ds-font-size-sm);
}
/* FX list: full-width rows (mobile) */
.fxList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}
.fxRowActive {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--ds-color-signal);
  font-size: var(--ds-font-size-xs);
  border: 1px solid var(--ds-color-signal-quiet);
  padding: 3px 8px;
}
.fxRowInactive {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--ds-color-text-muted);
  font-size: var(--ds-font-size-xs);
  padding: 3px 8px;
}
/* Stats: 2×2 */
.statsGridMobile {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--ds-color-border-default);
}
.statsGridMobile .statCell:nth-child(odd) {
  border-right: 1px solid var(--ds-color-border-default);
}
.statsGridMobile .statCell:nth-child(-n+2) {
  border-bottom: 1px solid var(--ds-color-border-default);
}
```

---

### Task 7: Verify tests pass and commit

**Files:** No new files.

- [ ] **Step 1: Run GuitarSection tests**

```bash
pnpm test --run GuitarSection.test.tsx 2>&1 | tail -20
```

Expected: all 14 tests PASS.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "error|Error|✓" | head -10
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test --run 2>&1 | tail -10
```

Expected: all tests pass (count increases by 14+ from the new test file).

- [ ] **Step 4: Run validate-content**

```bash
pnpm validate-content 2>&1 | grep -E "guitar|PASS|FAIL"
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add components/sections/GuitarSection/
git commit -m "feat(guitar): redesign Guitar Rig section — signal chain + influences + live cam"
```

---

## Self-Review Checklist

- **Spec coverage:** signal chain 4 nodes ✓ | FX grid/list ✓ | influences + strength ✓ | now obsessing ✓ | live cam CRT ✓ | stats 4-cell ✓ | mobile layout ✓ | 2×2 mobile stats ✓ | strength dots ✓ | XSS-safe bold parsing ✓
- **Placeholder scan:** none found
- **Type consistency:** `GuitarRig['signalChain'][number]` used throughout, `Block` and `Influence` aliases defined once at top of GuitarSection.tsx
- **Architect findings addressed:** inline-bold uses split+JSX (not dangerouslySetInnerHTML) ✓ | `role="slider"` not used (guitar section is RSC, no interactive elements) ✓ | strength dots for Jimmy Page documented as 3/5 ✓ | schema migration consumer-scan: only `GuitarSection.tsx` and `validate-content.ts` import `guitar-rig.ts` — both handled ✓
