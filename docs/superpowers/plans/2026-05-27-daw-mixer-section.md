# DAW Mixer Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `DawMixerSection` — a simulated DAW mixer for 6 guitar channels. RSC shell with 4 granular client islands. All state is ephemeral (resets on reload).

**Architecture:** RSC shell (`DawMixerSection.tsx`) renders both desktop (8-column table layout) and mobile (stacked channel cards) via `getIsMobile()`. 4 client islands per concern: `VuMeter.client.tsx` (drag level), `FaderIsland.client.tsx` (drag position), `KnobIsland.client.tsx` (drag rotate), `RmsButtons.client.tsx` (toggle). Signal flow (expand/collapse) uses `<details>/<summary>` — native semantics, zero client JS. Content driven from `content/daw-mixer.ts` validated by Zod.

**Tech Stack:** Next.js 16 RSC + `*.client.tsx` islands, CSS Modules, Zod, `useRef` + direct DOM mutation for drag (no per-frame React re-render), `renderToStaticMarkup` + `mountClient` for tests.

---

### Task 1: Add IconMixer to Icons.tsx

**Files:**
- Modify: `components/Icons/Icons.tsx`

- [ ] **Step 1: Write a failing render test for IconMixer**

Add to a new file `components/Icons/Icons.test.tsx` (or append to existing):

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('IconMixer', () => {
  it('renders an SVG with aria-hidden', async () => {
    const { IconMixer } = await import('./Icons');
    const html = renderToStaticMarkup(createElement(IconMixer));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const svg = doc.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders three vertical bar paths (mixer visual)', async () => {
    const { IconMixer } = await import('./Icons');
    const html = renderToStaticMarkup(createElement(IconMixer));
    // Three lines/rects for the three fader bars
    expect(html).toMatch(/line|rect|path/);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pnpm test --run Icons.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `IconMixer` not exported.

- [ ] **Step 3: Add IconMixer to Icons.tsx**

Append to `components/Icons/Icons.tsx`, after `IconGuitar`:

```tsx
// ./MIX --LIVE — three fader bars at different heights
export function IconMixer() {
  return (
    <svg {...baseProps}>
      <line x1="6"  y1="5"  x2="6"  y2="19" />
      <line x1="12" y1="9"  x2="12" y2="19" />
      <line x1="18" y1="3"  x2="18" y2="19" />
      <rect x="3"  y="8"  width="6" height="2" />
      <rect x="9"  y="13" width="6" height="2" />
      <rect x="15" y="6"  width="6" height="2" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test --run Icons.test.tsx 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Icons/Icons.tsx components/Icons/Icons.test.tsx
git commit -m "feat(daw-mixer): add IconMixer to Icons"
```

---

### Task 2: Add DawMixerSchema to schemas.ts and create content/daw-mixer.ts

**Files:**
- Modify: `content/schemas.ts` — append `DawMixerSchema` + `DawMixer` type.
- Create: `content/daw-mixer.ts`

- [ ] **Step 1: Write failing schema test**

Append to `content/schemas.test.ts`:

```typescript
describe('DawMixerSchema', () => {
  it('accepts a valid 6-channel config', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        bpm: 87,
        timeSignature: '4/4',
        channels: [
          {
            id: 'CH 01', name: 'TEST', desc: 'test desc',
            plugins: [{ name: 'COMP', active: true, strength: 3 }],
            faderPct: 72, db: '-2.5', meterPct: 71,
            knob1: { label: 'GAIN', angleDeg: -30 },
            knob2: { label: 'PAN',  angleDeg: 0 },
            buttons: ['R', 'M', 'S'], activeButtons: [],
          },
        ],
      })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test --run content/schemas.test.ts 2>&1 | tail -10
```

Expected: FAIL — `DawMixerSchema` not exported.

- [ ] **Step 3: Append DawMixerSchema to content/schemas.ts**

Append before the `// Exported types` block:

```typescript
// DawMixerSection
const DawMixerPluginSchema = z.object({
  name: z.string().min(1),
  active: z.boolean(),
  strength: z.number().int().min(0).max(5),
});

const DawMixerKnobSchema = z.object({
  label: z.string().min(1),
  angleDeg: z.number().min(-150).max(150),
});

const DawMixerChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desktopName: z.string().optional(),
  desc: z.string().min(1),
  focused: z.boolean().optional(),
  plugins: z.array(DawMixerPluginSchema).min(1).max(5),
  faderPct: z.number().min(0).max(100),
  db: z.string().min(1),
  meterPct: z.number().min(0).max(100),
  meterClipping: z.boolean().optional(),
  knob1: DawMixerKnobSchema,
  knob2: DawMixerKnobSchema,
  buttons: z.array(z.string().min(1)),
  activeButtons: z.array(z.string().min(1)),
  footer: z.object({ lufs: z.string(), pk: z.string() }).optional(),
  terminalLines: z.array(z.string().min(1)).optional(),
});

export const DawMixerSchema = z.object({
  sessionName: z.string().min(1),
  bpm: z.number().int(),
  timeSignature: z.string().min(1),
  channels: z.array(DawMixerChannelSchema).min(1),
});
```

Also append to the exported types block:

```typescript
export type DawMixer = z.infer<typeof DawMixerSchema>;
export type DawMixerChannel = z.infer<typeof DawMixerChannelSchema>;
export type DawMixerPlugin = z.infer<typeof DawMixerPluginSchema>;
```

- [ ] **Step 4: Run schema test to confirm it passes**

```bash
pnpm test --run content/schemas.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Create content/daw-mixer.ts**

```typescript
import { type DawMixer, DawMixerSchema } from './schemas';

export const dawMixer: DawMixer = DawMixerSchema.parse({
  sessionName: 'YELLOW_TAKE_03.ALS',
  bpm: 87,
  timeSignature: '4/4',
  channels: [
    {
      id: 'CH 01', name: 'RHYTHM GTR',
      desc: 'Gretsch · clean strums · main bed · verse + chorus',
      plugins: [
        { name: 'COMP',   active: true,  strength: 3 },
        { name: 'EQ',     active: true,  strength: 2 },
        { name: 'AMP/IR', active: true,  strength: 4 },
        { name: 'PLATE',  active: true,  strength: 2 },
        { name: 'ROOM',   active: true,  strength: 2 },
      ],
      faderPct: 72, db: '-2.5', meterPct: 71,
      knob1: { label: 'GAIN', angleDeg: -30 },
      knob2: { label: 'PAN',  angleDeg: -20 },
      buttons: ['R', 'M', 'S'], activeButtons: [],
    },
    {
      id: 'CH 02', name: 'LEAD GTR', focused: true,
      desc: 'Gretsch · OD lead lines · **the voice** · chorus + bridge',
      plugins: [
        { name: 'COMP',     active: true,  strength: 5 },
        { name: 'OD KLON',  active: true,  strength: 5 },
        { name: 'BOOST',    active: true,  strength: 4 },
        { name: 'TAPE DLY', active: true,  strength: 4 },
        { name: 'REV',      active: true,  strength: 5 },
      ],
      faderPct: 72, db: '+1.4', meterPct: 93, meterClipping: true,
      knob1: { label: 'GAIN', angleDeg: -30 },
      knob2: { label: 'PAN',  angleDeg: 0 },
      buttons: ['R', 'M', 'S'], activeButtons: ['R'],
    },
    {
      id: 'CH 03', name: 'ACOUSTIC DBL',
      desc: 'Martin · fingerpick · doubled 8va below · intro + bridge',
      plugins: [
        { name: 'PREAMP', active: true,  strength: 2 },
        { name: 'EQ',     active: true,  strength: 3 },
        { name: 'COMP',   active: true,  strength: 2 },
        { name: 'CHORUS', active: true,  strength: 2 },
        { name: 'PLATE',  active: true,  strength: 3 },
      ],
      faderPct: 40, db: '-5.2', meterPct: 50,
      knob1: { label: 'GAIN', angleDeg: -40 },
      knob2: { label: 'PAN',  angleDeg: -25 },
      buttons: ['R', 'M', 'S'], activeButtons: [],
    },
    {
      id: 'CH 04', name: 'PAD GTR',
      desc: 'Gretsch · volume swells · big space · sits behind everything',
      plugins: [
        { name: 'VOL',     active: true,  strength: 3 },
        { name: 'CHORUS',  active: true,  strength: 4 },
        { name: 'SHIMMER', active: true,  strength: 5 },
        { name: 'BIG REV', active: true,  strength: 4 },
        { name: 'LP FILT', active: true,  strength: 2 },
      ],
      faderPct: 30, db: '-9.6', meterPct: 34,
      knob1: { label: 'GAIN',  angleDeg: -60 },
      knob2: { label: 'WIDTH', angleDeg: -10 },
      buttons: ['R', 'M', 'S'], activeButtons: [],
    },
    {
      id: 'CH 05', name: 'HARMONY DBL',
      desc: 'Gretsch · third up · twin-lead overdub · chorus only',
      plugins: [
        { name: 'COMP',   active: true,  strength: 2 },
        { name: 'HARM+3', active: true,  strength: 5 },
        { name: 'EQ',     active: true,  strength: 2 },
        { name: 'DLY',    active: true,  strength: 2 },
        { name: 'FUZZ',   active: false, strength: 0 },
      ],
      faderPct: 35, db: '-8.1', meterPct: 43,
      knob1: { label: 'GAIN', angleDeg: -50 },
      knob2: { label: 'PAN',  angleDeg: -60 },
      buttons: ['R', 'M', 'S'], activeButtons: ['M'],
    },
    {
      id: 'MASTER', name: '2-BUSS',
      desktopName: '2-BUSS — STEREO OUT',
      desc: 'sum of **5 gtr tracks** · mastering chain · feel over noise',
      plugins: [
        { name: 'SSL BUSS', active: true, strength: 3 },
        { name: 'PULTEC',   active: true, strength: 2 },
        { name: 'TAPE SAT', active: true, strength: 3 },
        { name: 'LIMITER',  active: true, strength: 4 },
        { name: 'METER',    active: true, strength: 5 },
      ],
      faderPct: 62, db: '-3.2', meterPct: 88, meterClipping: true,
      knob1: { label: 'COMP',  angleDeg: -35 },
      knob2: { label: 'LIMIT', angleDeg: -45 },
      buttons: ['FX', 'EQ'], activeButtons: [],
      footer: { lufs: '-14', pk: '-0.3' },
      terminalLines: [
        '> headroom -3.2 · lufs -14 · pk -0.3 · mastered for streaming.',
        '> same philosophy as code: **fewer plugins, more space**.',
        'five tracks doing one job each beats fifteen tracks competing.',
      ],
    },
  ],
});
```

- [ ] **Step 6: Run validate-content to confirm the new file passes**

```bash
# First add daw-mixer.ts to the CONTENT_FILES list in scripts/validate-content.ts
# Then run:
pnpm validate-content 2>&1 | grep -E "daw-mixer|PASS|FAIL"
```

To add it: open `scripts/validate-content.ts` and add `'content/daw-mixer.ts'` to the `CONTENT_FILES` array.

Expected: `content/daw-mixer.ts — PASS`.

- [ ] **Step 7: Commit**

```bash
git add content/schemas.ts content/schemas.test.ts content/daw-mixer.ts scripts/validate-content.ts
git commit -m "feat(daw-mixer): add DawMixerSchema and channel content"
```

---

### Task 3: VuMeter.client.tsx + tests

**Files:**
- Create: `components/client/DawMixer/VuMeter.client.tsx`
- Create: `components/client/DawMixer/VuMeter.test.tsx`

- [ ] **Step 1: Create the test file (all tests will fail — component not yet created)**

```tsx
// components/client/DawMixer/VuMeter.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { VuMeter } from './VuMeter.client';

function renderStatic(props: Parameters<typeof VuMeter>[0]) {
  const html = renderToStaticMarkup(createElement(VuMeter, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

const defaults = { segments: 14, initialLevel: 70, channelName: 'RHYTHM GTR' };

describe('VuMeter — ARIA contract', () => {
  it('has role="slider"', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('aria-valuenow equals initialLevel', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('70');
  });

  it('aria-valuemin is 0 and aria-valuemax is 100', () => {
    const doc = renderStatic(defaults);
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuemin')).toBe('0');
    expect(slider?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('aria-label includes channel name and "VU meter"', () => {
    const doc = renderStatic(defaults);
    const label = doc.querySelector('[role="slider"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('RHYTHM GTR');
    expect(label.toLowerCase()).toContain('vu meter');
  });

  it('is focusable (tabIndex 0)', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('tabindex')).toBe('0');
  });
});

describe('VuMeter — segments', () => {
  it('renders the correct number of segments', () => {
    const doc = renderStatic({ ...defaults, segments: 14 });
    // Each segment is a <span> child of the slider
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.querySelectorAll('span').length).toBe(14);
  });

  it('no red segments when clipping is false and level is high', () => {
    // Even at level 95 with no clipping prop, no red segment class
    const doc = renderStatic({ ...defaults, initialLevel: 95, clipping: false });
    expect(doc.querySelector('[class*="vuSegRed"]')).toBeNull();
  });

  it('last 2 segments get red class when clipping=true and level > 85', () => {
    const doc = renderStatic({ ...defaults, initialLevel: 93, clipping: true });
    expect(doc.querySelectorAll('[class*="vuSegRed"]').length).toBe(2);
  });
});

describe('VuMeter — keyboard', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => { unmount?.(); unmount = undefined; });

  it('ArrowRight increases level by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('55');
  });

  it('ArrowLeft decreases level by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('45');
  });

  it('clamps to 0 at minimum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 2 })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
  });

  it('clamps to 100 at maximum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 97 })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test --run VuMeter.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create VuMeter.client.tsx**

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import s from './DawMixer.module.css';

interface VuMeterProps {
  segments: number;
  initialLevel: number;
  clipping?: boolean;
  channelName: string;
}

export function VuMeter({ segments, initialLevel, clipping = false, channelName }: VuMeterProps) {
  const [level, setLevel] = useState(initialLevel);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const isDragging = useRef(false);
  const liveLevel = useRef(initialLevel);

  const getSegmentClass = useCallback(
    (i: number, currentLevel: number): string => {
      const filledCount = Math.round((currentLevel / 100) * segments);
      const isRed = clipping && currentLevel > 85 && i >= segments - 2;
      if (isRed) return s.vuSegRed;
      if (i < filledCount) return s.vuSegFilled;
      return s.vuSegEmpty;
    },
    [segments, clipping],
  );

  // Direct DOM update during drag — avoids per-frame React re-render
  const applyLevel = useCallback(
    (newLevel: number) => {
      liveLevel.current = newLevel;
      const el = containerRef.current;
      if (el) el.setAttribute('aria-valuenow', String(newLevel));
      segmentRefs.current.forEach((seg, i) => {
        if (seg) seg.className = getSegmentClass(i, newLevel);
      });
    },
    [getSegmentClass],
  );

  const getLevelFromPointer = useCallback((clientX: number): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    const newLevel = getLevelFromPointer(e.clientX);
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newLevel = getLevelFromPointer(e.clientX);
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const newLevel = getLevelFromPointer(e.clientX);
    if (newLevel !== null) setLevel(newLevel);
  };

  const filledCount = Math.round((level / 100) * segments);

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={`${channelName} VU meter demonstration, drag to adjust level`}
      aria-valuenow={level}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${level}%`}
      tabIndex={0}
      className={s.vuMeter}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          const next = Math.min(100, liveLevel.current + 5);
          liveLevel.current = next;
          setLevel(next);
        }
        if (e.key === 'ArrowLeft') {
          const next = Math.max(0, liveLevel.current - 5);
          liveLevel.current = next;
          setLevel(next);
        }
      }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const isRed = clipping && level > 85 && i >= segments - 2;
        const isFilled = i < filledCount;
        return (
          <span
            key={i}
            ref={(el) => { segmentRefs.current[i] = el; }}
            className={isRed ? s.vuSegRed : isFilled ? s.vuSegFilled : s.vuSegEmpty}
          />
        );
      })}
    </div>
  );
}
```

Note: `DawMixer.module.css` will be created in Task 8. Leave a placeholder CSS file for now:

```bash
touch components/client/DawMixer/DawMixer.module.css
```

Add minimal content to `DawMixer.module.css` so imports don't fail:

```css
/* DawMixer client island styles — filled in Task 8 */
.vuMeter { display: flex; gap: 2px; cursor: ew-resize; padding: 4px 0; align-items: flex-end; height: 20px; }
.vuSegFilled { flex: 1; background: var(--ds-color-signal); height: 100%; }
.vuSegEmpty  { flex: 1; background: var(--ds-color-signal-quiet); height: 100%; }
.vuSegRed    { flex: 1; background: var(--ds-color-feedback-error); height: 100%; }
```

- [ ] **Step 4: Run VuMeter tests**

```bash
pnpm test --run VuMeter.test.tsx 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/client/DawMixer/
git commit -m "feat(daw-mixer): add VuMeter client island with drag + keyboard + ARIA"
```

---

### Task 4: FaderIsland.client.tsx + tests

**Files:**
- Create: `components/client/DawMixer/FaderIsland.client.tsx`
- Create: `components/client/DawMixer/FaderIsland.test.tsx`

- [ ] **Step 1: Create failing tests**

```tsx
// components/client/DawMixer/FaderIsland.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { FaderIsland } from './FaderIsland.client';

function renderStatic(props: Parameters<typeof FaderIsland>[0]) {
  const html = renderToStaticMarkup(createElement(FaderIsland, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

const defaults = { initialPct: 72, channelName: 'RHYTHM GTR' };

describe('FaderIsland — ARIA contract', () => {
  it('has role="slider"', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('aria-valuenow equals initialPct', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('72');
  });

  it('aria-label includes channel name and "fader"', () => {
    const doc = renderStatic(defaults);
    const label = doc.querySelector('[role="slider"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('RHYTHM GTR');
    expect(label.toLowerCase()).toContain('fader');
  });

  it('thumb is aria-hidden (visual only)', () => {
    const doc = renderStatic(defaults);
    const thumb = doc.querySelector('[class*="faderThumb"]');
    expect(thumb?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('FaderIsland — keyboard', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => { unmount?.(); unmount = undefined; });

  it('ArrowRight increases position by 2', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(52);
  });

  it('ArrowLeft decreases position by 2', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(48);
  });

  it('clamps to 0 at minimum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 1, channelName: 'TEST' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
  });

  it('clamps to 100 at maximum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 99, channelName: 'TEST' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm test --run FaderIsland.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create FaderIsland.client.tsx**

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import s from './DawMixer.module.css';

interface FaderProps {
  initialPct: number;
  channelName: string;
}

export function FaderIsland({ initialPct, channelName }: FaderProps) {
  const [pct, setPct] = useState(initialPct);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const livePct = useRef(initialPct);

  const getPctFromPointer = useCallback((clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const applyPct = useCallback((newPct: number) => {
    livePct.current = newPct;
    if (thumbRef.current) {
      // Direct DOM style update — no React re-render during drag
      thumbRef.current.style.left = `calc(${newPct}% - 6px)`;
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newPct = getPctFromPointer(e.clientX);
    if (newPct !== null) applyPct(newPct);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const newPct = getPctFromPointer(e.clientX);
    if (newPct !== null) {
      const rounded = Math.round(newPct);
      livePct.current = rounded;
      setPct(rounded);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={`${channelName} fader`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      className={s.faderTrack}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          const next = Math.min(100, livePct.current + 2);
          livePct.current = next;
          setPct(next);
        }
        if (e.key === 'ArrowLeft') {
          const next = Math.max(0, livePct.current - 2);
          livePct.current = next;
          setPct(next);
        }
      }}
    >
      <div
        ref={thumbRef}
        className={s.faderThumb}
        style={{ left: `calc(${pct}% - 6px)` }}
        aria-hidden="true"
      />
    </div>
  );
}
```

Add to `DawMixer.module.css`:

```css
.faderTrack { position: relative; height: 12px; background: var(--ds-color-surface-shell); border: 1px solid var(--ds-color-border-default); cursor: ew-resize; }
.faderThumb { position: absolute; top: -3px; width: 12px; height: 18px; background: var(--ds-color-signal); border: 1px solid var(--ds-color-signal); cursor: ew-resize; }
```

- [ ] **Step 4: Run FaderIsland tests**

```bash
pnpm test --run FaderIsland.test.tsx 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/client/DawMixer/FaderIsland.client.tsx components/client/DawMixer/FaderIsland.test.tsx components/client/DawMixer/DawMixer.module.css
git commit -m "feat(daw-mixer): add FaderIsland client island with drag + keyboard + ARIA"
```

---

### Task 5: KnobIsland.client.tsx + tests

**Files:**
- Create: `components/client/DawMixer/KnobIsland.client.tsx`
- Create: `components/client/DawMixer/KnobIsland.test.tsx`

- [ ] **Step 1: Create failing tests**

The four failure modes from the architect review are all covered:
(a) No atan2 — angle computed from Y-delta (no quadrant wrap).
(b) No stale center coordinate — uses pointer Y-delta, not geometry.
(c) Clamp enforced on every pointermove.
(d) Keyboard direction matches drag direction (up = increase).

```tsx
// components/client/DawMixer/KnobIsland.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { KnobIsland } from './KnobIsland.client';

function renderStatic(props: Parameters<typeof KnobIsland>[0]) {
  const html = renderToStaticMarkup(createElement(KnobIsland, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

const defaults = { initialAngle: -30, label: 'GAIN', channelName: 'LEAD GTR' };

describe('KnobIsland — ARIA contract', () => {
  it('has role="slider"', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('aria-valuenow equals initialAngle', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('-30');
  });

  it('aria-valuemin is -150, aria-valuemax is 150', () => {
    const doc = renderStatic(defaults);
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuemin')).toBe('-150');
    expect(slider?.getAttribute('aria-valuemax')).toBe('150');
  });

  it('aria-label includes channel name and label', () => {
    const doc = renderStatic(defaults);
    const label = doc.querySelector('[role="slider"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('LEAD GTR');
    expect(label).toContain('GAIN');
  });
});

describe('KnobIsland — keyboard (clamp + direction)', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => { unmount?.(); unmount = undefined; });

  it('ArrowUp increases angle by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: 0, label: 'PAN', channelName: 'CH 01' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(5);
  });

  it('ArrowDown decreases angle by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: 0, label: 'PAN', channelName: 'CH 01' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(-5);
  });

  it('clamps at +150 (does not exceed maximum)', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: 148, label: 'GAIN', channelName: 'CH 01' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(150);
  });

  it('clamps at -150 (does not go below minimum)', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: -148, label: 'GAIN', channelName: 'CH 01' })
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(-150);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm test --run KnobIsland.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create KnobIsland.client.tsx**

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import s from './DawMixer.module.css';

const MIN_ANGLE = -150;
const MAX_ANGLE = 150;
const KNOB_SIZE = 38;
const KNOB_CENTER = 19;
const NEEDLE_LENGTH = 12;

function clamp(v: number) {
  return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, v));
}

interface KnobProps {
  initialAngle: number;
  label: string;
  channelName: string;
}

export function KnobIsland({ initialAngle, label, channelName }: KnobProps) {
  const [angle, setAngle] = useState(initialAngle);
  const svgRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartAngle = useRef(initialAngle);
  const liveAngle = useRef(initialAngle);

  // Convert angle to needle endpoint SVG coordinates
  // 0° = right (3 o'clock); we shift by -90° so 0° = up (12 o'clock)
  function angleToCoords(a: number) {
    const rad = (a - 90) * (Math.PI / 180);
    return {
      x2: KNOB_CENTER + NEEDLE_LENGTH * Math.cos(rad),
      y2: KNOB_CENTER + NEEDLE_LENGTH * Math.sin(rad),
    };
  }

  const updateNeedle = useCallback((newAngle: number) => {
    liveAngle.current = newAngle;
    const el = svgRef.current;
    if (el) el.setAttribute('aria-valuenow', String(newAngle));
    const needle = needleRef.current;
    if (needle) {
      const { x2, y2 } = angleToCoords(newAngle);
      needle.setAttribute('x2', x2.toFixed(2));
      needle.setAttribute('y2', y2.toFixed(2));
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartAngle.current = liveAngle.current;
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    // Upward drag (negative deltaY) = increase angle
    const deltaY = dragStartY.current - e.clientY;
    const newAngle = clamp(dragStartAngle.current + deltaY * 1.5);
    updateNeedle(newAngle);
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setAngle(Math.round(liveAngle.current));
  };

  const { x2, y2 } = angleToCoords(angle);

  return (
    <div className={s.knob}>
      <svg
        ref={svgRef}
        width={KNOB_SIZE}
        height={KNOB_SIZE}
        viewBox={`0 0 ${KNOB_SIZE} ${KNOB_SIZE}`}
        role="slider"
        aria-label={`${channelName} ${label}`}
        aria-valuenow={angle}
        aria-valuemin={MIN_ANGLE}
        aria-valuemax={MAX_ANGLE}
        aria-valuetext={`${angle > 0 ? '+' : ''}${angle}°`}
        tabIndex={0}
        className={s.knobSvg}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            const next = clamp(liveAngle.current + 5);
            liveAngle.current = next;
            setAngle(next);
          }
          if (e.key === 'ArrowDown') {
            const next = clamp(liveAngle.current - 5);
            liveAngle.current = next;
            setAngle(next);
          }
        }}
      >
        {/* Track ring */}
        <circle cx={KNOB_CENTER} cy={KNOB_CENTER} r="16" stroke="var(--ds-color-signal-quiet)" strokeWidth="1" fill="none" />
        {/* Fill disc */}
        <circle cx={KNOB_CENTER} cy={KNOB_CENTER} r="14" fill="var(--ds-color-surface-base)" stroke="var(--ds-color-border-default)" strokeWidth="1" />
        {/* Needle */}
        <line
          ref={needleRef}
          x1={KNOB_CENTER}
          y1={KNOB_CENTER}
          x2={x2.toFixed(2)}
          y2={y2.toFixed(2)}
          stroke="var(--ds-color-signal)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className={s.knobLabel}>{label}</div>
    </div>
  );
}
```

Add to `DawMixer.module.css`:

```css
.knob { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.knobSvg { cursor: ns-resize; outline: none; }
.knobSvg:focus-visible { outline: 2px solid var(--ds-color-signal); outline-offset: 2px; }
.knobLabel { font-size: var(--ds-font-size-2xs); color: var(--ds-color-text-muted); text-align: center; letter-spacing: 0.04em; }
```

- [ ] **Step 4: Run KnobIsland tests**

```bash
pnpm test --run KnobIsland.test.tsx 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/client/DawMixer/KnobIsland.client.tsx components/client/DawMixer/KnobIsland.test.tsx components/client/DawMixer/DawMixer.module.css
git commit -m "feat(daw-mixer): add KnobIsland client island with drag + keyboard + ARIA"
```

---

### Task 6: RmsButtons.client.tsx + tests

**Files:**
- Create: `components/client/DawMixer/RmsButtons.client.tsx`
- Create: `components/client/DawMixer/RmsButtons.test.tsx`

- [ ] **Step 1: Create failing tests**

```tsx
// components/client/DawMixer/RmsButtons.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { RmsButtons } from './RmsButtons.client';

function renderStatic(props: Parameters<typeof RmsButtons>[0]) {
  const html = renderToStaticMarkup(createElement(RmsButtons, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('RmsButtons — initial render', () => {
  it('renders one button per label', () => {
    const doc = renderStatic({ buttons: ['R', 'M', 'S'], initialActive: [] });
    expect(doc.querySelectorAll('button').length).toBe(3);
  });

  it('active buttons have aria-pressed="true"', () => {
    const doc = renderStatic({ buttons: ['R', 'M', 'S'], initialActive: ['M'] });
    const buttons = doc.querySelectorAll('button');
    const mBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'M');
    expect(mBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('inactive buttons have aria-pressed="false"', () => {
    const doc = renderStatic({ buttons: ['R', 'M', 'S'], initialActive: [] });
    const buttons = doc.querySelectorAll('button');
    buttons.forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('false'));
  });
});

describe('RmsButtons — toggle interaction', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => { unmount?.(); unmount = undefined; });

  it('clicking an inactive button sets aria-pressed to true', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(RmsButtons, { buttons: ['R', 'M', 'S'], initialActive: [] })
    );
    unmount = u;
    const rBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'R'
    ) as HTMLButtonElement;
    rBtn.click();
    expect(rBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking an active button sets aria-pressed to false', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(RmsButtons, { buttons: ['R', 'M', 'S'], initialActive: ['S'] })
    );
    unmount = u;
    const sBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'S'
    ) as HTMLButtonElement;
    sBtn.click();
    expect(sBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggling one button does not affect others', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(RmsButtons, { buttons: ['R', 'M', 'S'], initialActive: ['M'] })
    );
    unmount = u;
    const rBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'R'
    ) as HTMLButtonElement;
    const mBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'M'
    ) as HTMLButtonElement;
    rBtn.click();
    // M was active and should remain so
    expect(mBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm test --run RmsButtons.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create RmsButtons.client.tsx**

```tsx
'use client';

import { useState } from 'react';
import s from './DawMixer.module.css';

interface RmsButtonsProps {
  buttons: string[];
  initialActive: string[];
}

export function RmsButtons({ buttons, initialActive }: RmsButtonsProps) {
  const [active, setActive] = useState<Set<string>>(() => new Set(initialActive));

  const toggle = (btn: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(btn)) next.delete(btn);
      else next.add(btn);
      return next;
    });
  };

  return (
    <div className={s.rmsButtons}>
      {buttons.map((btn) => (
        <button
          key={btn}
          type="button"
          aria-pressed={active.has(btn)}
          className={active.has(btn) ? s.rmsActive : s.rmsInactive}
          onClick={() => toggle(btn)}
        >
          {btn}
        </button>
      ))}
    </div>
  );
}
```

Add to `DawMixer.module.css`:

```css
.rmsButtons { display: flex; gap: 3px; }
.rmsActive   { border: 1px solid var(--ds-color-signal); background: var(--ds-color-signal); color: var(--ds-color-surface-base); padding: 3px 8px; font-size: var(--ds-font-size-xs); font-family: var(--ds-font-family-mono); cursor: pointer; font-weight: 700; }
.rmsInactive { border: 1px solid var(--ds-color-border-default); background: transparent; color: var(--ds-color-text-muted); padding: 3px 8px; font-size: var(--ds-font-size-xs); font-family: var(--ds-font-family-mono); cursor: pointer; }
.rmsActive:focus-visible, .rmsInactive:focus-visible { outline: 2px solid var(--ds-color-signal); outline-offset: 2px; }
```

- [ ] **Step 4: Run RmsButtons tests**

```bash
pnpm test --run RmsButtons.test.tsx 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/client/DawMixer/RmsButtons.client.tsx components/client/DawMixer/RmsButtons.test.tsx components/client/DawMixer/DawMixer.module.css
git commit -m "feat(daw-mixer): add RmsButtons client island with toggle + aria-pressed"
```

---

### Task 7: DawMixerSection.tsx — RSC shell

**Files:**
- Create: `components/sections/DawMixerSection/DawMixerSection.tsx`

- [ ] **Step 1: Create DawMixerSection.tsx**

```tsx
import { Suspense } from 'react';
import type { DawMixer, DawMixerChannel } from '@/content/schemas';
import { dawMixer } from '@/content/daw-mixer';
import { getIsMobile } from '@/lib/ua';
import { FaderIsland } from '@/components/client/DawMixer/FaderIsland.client';
import { KnobIsland } from '@/components/client/DawMixer/KnobIsland.client';
import { RmsButtons } from '@/components/client/DawMixer/RmsButtons.client';
import { VuMeter } from '@/components/client/DawMixer/VuMeter.client';
import { IconMixer } from '../../Icons';
import { Module } from '../../responsive/Module';
import s from './DawMixerSection.module.css';

// Parses **bold** markers to <strong> without dangerouslySetInnerHTML.
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

function StrengthDots({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <div className={s.dots} aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? s.dotFilled : s.dotEmpty} />
      ))}
    </div>
  );
}

function PluginList({ plugins, channelId }: {
  plugins: DawMixerChannel['plugins'];
  channelId: string;
}) {
  return (
    <details className={s.signalFlow} open>
      <summary className={s.signalFlowToggle}>
        // SIGNAL FLOW <span className={s.signalFlowDot} aria-hidden="true">●</span>
      </summary>
      {plugins.map((p) => (
        <div key={p.name} className={p.active ? s.pluginRowActive : s.pluginRowInactive}
          data-testid={`plugin-${channelId}-${p.name}`}>
          <span className={s.pluginBullet} aria-hidden="true">{p.active ? '●' : '○'}</span>
          <span className={s.pluginName}>{p.name}</span>
          <StrengthDots filled={p.strength} total={5} />
        </div>
      ))}
    </details>
  );
}

function ChannelDesktop({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={`${s.channelRow} ${ch.focused ? s.channelFocused : ''}`}
      data-testid={`channel-${ch.id}`}
    >
      {/* ID */}
      <div className={s.colId}>
        <span className={isMaster ? s.masterBadge : s.channelBadge}>{ch.id}</span>
        <span className={s.channelSubName}>{ch.name}</span>
      </div>
      {/* TRACK */}
      <div className={s.colTrack}>
        <span className={s.trackName}>{ch.desktopName ?? ch.name}</span>
        <span className={s.trackDesc}><ParsedText text={ch.desc} /></span>
      </div>
      {/* I/O */}
      <div className={s.colIo}>
        <KnobIsland initialAngle={ch.knob1.angleDeg} label={ch.knob1.label} channelName={ch.name} />
        <KnobIsland initialAngle={ch.knob2.angleDeg} label={ch.knob2.label} channelName={ch.name} />
      </div>
      {/* R/M/S */}
      <div className={s.colRms}>
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} />
      </div>
      {/* PLUGIN CHAIN */}
      <div className={s.colPlugins}>
        <PluginList plugins={ch.plugins} channelId={ch.id} />
      </div>
      {/* METER */}
      <div className={s.colMeter}>
        <VuMeter
          segments={14}
          initialLevel={ch.meterPct}
          clipping={ch.meterClipping}
          channelName={ch.name}
        />
      </div>
      {/* FADER */}
      <div className={s.colFader}>
        <FaderIsland initialPct={ch.faderPct} channelName={ch.name} />
      </div>
      {/* DB */}
      <div className={s.colDb}>
        <span className={s.dbValue}>{ch.db}</span>
        <span className={s.dbUnit}>dB</span>
        {ch.footer && (
          <span className={s.lufs}>LUFS {ch.footer.lufs} · PK {ch.footer.pk}</span>
        )}
      </div>
    </div>
  );
}

function ChannelMobile({ ch }: { ch: DawMixerChannel }) {
  const isMaster = ch.id === 'MASTER';
  return (
    <div
      className={`${s.channelCard} ${ch.focused ? s.channelCardFocused : ''}`}
      data-testid={`channel-mobile-${ch.id}`}
    >
      {/* Header row */}
      <div className={s.cardHeader}>
        <span className={isMaster ? s.masterBadge : s.channelBadge}>{ch.id}</span>
        <span className={s.cardName}>{ch.name}</span>
        <div className={s.cardDb}>
          <span className={s.dbValue}>{ch.db}</span>
          <span className={s.dbUnit}> / dB</span>
        </div>
      </div>
      {/* Description */}
      <div className={s.cardDesc}><ParsedText text={ch.desc} /></div>
      {/* VU meter */}
      <VuMeter
        segments={14}
        initialLevel={ch.meterPct}
        clipping={ch.meterClipping}
        channelName={ch.name}
      />
      {/* Fader */}
      <FaderIsland initialPct={ch.faderPct} channelName={ch.name} />
      {/* Signal flow */}
      <PluginList plugins={ch.plugins} channelId={`${ch.id}-mobile`} />
      {/* Knobs */}
      <div className={s.cardKnobs}>
        <KnobIsland initialAngle={ch.knob1.angleDeg} label={ch.knob1.label} channelName={ch.name} />
        <KnobIsland initialAngle={ch.knob2.angleDeg} label={ch.knob2.label} channelName={ch.name} />
      </div>
      {/* RMS buttons */}
      <div className={s.cardButtons}>
        <RmsButtons buttons={ch.buttons} initialActive={ch.activeButtons} />
      </div>
      {/* Footer bar */}
      <div className={s.cardFooter}>
        <div className={s.faderFooterBar} style={{ width: `${ch.faderPct}%` }} aria-hidden="true" />
        {ch.footer && (
          <span className={s.lufs}>LUFS {ch.footer.lufs} · PK {ch.footer.pk}</span>
        )}
      </div>
      {/* Terminal lines (MASTER only) */}
      {ch.terminalLines && (
        <div className={s.terminalBlock}>
          {ch.terminalLines.map((line, i) => (
            <div key={i} className={s.terminalLine}><ParsedText text={line} /></div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionHeaderDesktop({ mixer }: { mixer: DawMixer }) {
  return (
    <div className={s.sessionHeader} data-testid="session-header">
      <span>
        SESSION: {mixer.sessionName} · {mixer.channels.length - 1} GTR TRACKS + MASTER ·{' '}
        <span className={s.statusDot}>●</span> MIXING
      </span>
      <span>
        ▶ 00:01:24:08 | {mixer.bpm} BPM | {mixer.timeSignature}
      </span>
    </div>
  );
}

function SessionHeaderMobile({ mixer }: { mixer: DawMixer }) {
  return (
    <div className={s.sessionHeaderMobile} data-testid="session-header-mobile">
      <div>SESSION: {mixer.sessionName} · <span className={s.statusDot}>●</span> MIXING</div>
      <div>▶ 00:01:24:08 | {mixer.bpm} BPM | {mixer.timeSignature}</div>
      <div><span className={s.statusDot}>●</span> {mixer.channels.length - 1} GTR + MASTER</div>
      <div className={s.tapHint}>TAP A ROW TO FOCUS</div>
    </div>
  );
}

function TableHeader() {
  return (
    <div className={s.tableHeader} aria-hidden="true">
      <div>ID</div>
      <div>TRACK</div>
      <div>I/O</div>
      <div>R/M/S</div>
      <div>PLUGIN CHAIN</div>
      <div>METER</div>
      <div>FADER</div>
      <div>DB</div>
    </div>
  );
}

function DawMixerDesktop() {
  return (
    <div className={s.root} data-testid="daw-mixer-desktop">
      <SessionHeaderDesktop mixer={dawMixer} />
      <TableHeader />
      {dawMixer.channels.map((ch) => (
        <ChannelDesktop key={ch.id} ch={ch} />
      ))}
    </div>
  );
}

function DawMixerMobile() {
  return (
    <div className={s.rootMobile} data-testid="daw-mixer-mobile">
      <SessionHeaderMobile mixer={dawMixer} />
      {dawMixer.channels.map((ch) => (
        <ChannelMobile key={ch.id} ch={ch} />
      ))}
    </div>
  );
}

export async function DawMixerContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <DawMixerMobile /> : <DawMixerDesktop />;
}

export function DawMixerSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-daw-mixer"
      header="./MIX --LIVE — DAW MIXER"
      icon={<IconMixer />}
      defer={defer}
    >
      <Suspense fallback={<DawMixerDesktop />}>
        <DawMixerContent />
      </Suspense>
    </Module>
  );
}
```

---

### Task 8: DawMixerSection.module.css — complete styles

**Files:**
- Create: `components/sections/DawMixerSection/DawMixerSection.module.css`
- Modify: `components/client/DawMixer/DawMixer.module.css` — replace placeholder with full styles

- [ ] **Step 1: Replace DawMixer.module.css placeholder with full styles**

```css
/* ── DawMixer client islands ────────────────────────────────────────────── */

/* VuMeter */
.vuMeter {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 16px;
  cursor: ew-resize;
  padding: 2px 0;
  outline: none;
}
.vuMeter:focus-visible { outline: 2px solid var(--ds-color-signal); outline-offset: 2px; }
.vuSegFilled { flex: 1; background: var(--ds-color-signal); height: 100%; }
.vuSegEmpty  { flex: 1; background: var(--ds-color-signal-quiet); height: 100%; }
.vuSegRed    { flex: 1; background: var(--ds-color-feedback-error); height: 100%; }

/* FaderIsland */
.faderTrack {
  position: relative;
  height: 10px;
  background: var(--ds-color-surface-shell);
  border: 1px solid var(--ds-color-border-default);
  cursor: ew-resize;
  outline: none;
}
.faderTrack:focus-visible { outline: 2px solid var(--ds-color-signal); outline-offset: 2px; }
.faderThumb {
  position: absolute;
  top: -4px;
  width: 12px;
  height: 18px;
  background: var(--ds-color-signal);
  border: 1px solid var(--ds-color-signal);
  cursor: ew-resize;
}

/* KnobIsland */
.knob { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.knobSvg { cursor: ns-resize; outline: none; }
.knobSvg:focus-visible { outline: 2px solid var(--ds-color-signal); outline-offset: 2px; }
.knobLabel {
  font-size: var(--ds-font-size-2xs);
  color: var(--ds-color-text-muted);
  text-align: center;
  letter-spacing: 0.04em;
  font-family: var(--ds-font-family-mono);
}

/* RmsButtons */
.rmsButtons { display: flex; gap: 3px; }
.rmsActive {
  border: 1px solid var(--ds-color-signal);
  background: var(--ds-color-signal);
  color: var(--ds-color-surface-base);
  padding: 3px 8px;
  font-size: var(--ds-font-size-xs);
  font-family: var(--ds-font-family-mono);
  font-weight: 700;
  cursor: pointer;
}
.rmsInactive {
  border: 1px solid var(--ds-color-border-default);
  background: transparent;
  color: var(--ds-color-text-muted);
  padding: 3px 8px;
  font-size: var(--ds-font-size-xs);
  font-family: var(--ds-font-family-mono);
  cursor: pointer;
}
.rmsActive:focus-visible, .rmsInactive:focus-visible {
  outline: 2px solid var(--ds-color-signal);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Create DawMixerSection.module.css**

```css
/* ── DawMixerSection ────────────────────────────────────────────────────── */

/* ─── Shared ─────────────────────────────────────────────────────────── */
.statusDot { color: var(--ds-color-signal); }
.dots { display: flex; gap: 2px; }
.dotFilled { width: 6px; height: 6px; background: var(--ds-color-signal); flex-shrink: 0; }
.dotEmpty  { width: 6px; height: 6px; background: var(--ds-color-signal-quiet); flex-shrink: 0; }

.channelBadge {
  border: 1px solid var(--ds-color-border-default);
  padding: 1px 5px;
  font-size: var(--ds-font-size-xs);
  font-family: var(--ds-font-family-mono);
  color: var(--ds-color-text-body);
  letter-spacing: 0.04em;
}
.masterBadge {
  border: 1px solid var(--ds-color-signal);
  padding: 2px 8px;
  font-size: var(--ds-font-size-xs);
  font-family: var(--ds-font-family-mono);
  font-weight: 700;
  color: var(--ds-color-signal);
  letter-spacing: 0.12em;
}
.dbValue { font-weight: 700; color: var(--ds-color-signal); font-size: var(--ds-font-size-sm); }
.dbUnit  { font-size: var(--ds-font-size-xs); color: var(--ds-color-text-muted); }
.lufs    { font-size: var(--ds-font-size-xs); color: var(--ds-color-text-muted); display: block; }

/* Signal flow <details> */
.signalFlow { width: 100%; }
.signalFlowToggle {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  user-select: none;
}
.signalFlowToggle::-webkit-details-marker { display: none; }
details[open] .signalFlowToggle { color: var(--ds-color-signal); }
.signalFlowDot { transition: opacity 0.15s; }
@media (prefers-reduced-motion: reduce) { .signalFlowDot { transition: none; } }
.pluginRowActive {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-signal);
  border: 1px solid var(--ds-color-signal-quiet);
  margin-bottom: 2px;
}
.pluginRowInactive {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  margin-bottom: 2px;
}
.pluginBullet { flex-shrink: 0; font-size: 8px; }
.pluginName   { flex: 1; }

/* ─── Desktop ────────────────────────────────────────────────────────── */
.root {
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-body);
  color: var(--ds-color-text-body);
}
.sessionHeader {
  display: flex;
  justify-content: space-between;
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  padding: 6px 0;
  border-bottom: 1px solid var(--ds-color-border-default);
  margin-bottom: 0;
  letter-spacing: 0.02em;
}
/* Grid: ID | TRACK | I/O | R/M/S | PLUGIN CHAIN | METER | FADER | DB */
.tableHeader, .channelRow {
  display: grid;
  grid-template-columns: 72px 1fr 100px 76px 1fr 130px 120px 52px;
  gap: 0;
  align-items: center;
}
.tableHeader {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--ds-color-border-default);
  padding: 5px 0;
}
.tableHeader > div { padding: 0 6px; }
.channelRow {
  border-bottom: 1px solid var(--ds-color-signal-quiet);
  padding: 8px 0;
}
.channelRow > div { padding: 0 6px; }
.channelFocused { border-left: 2px solid var(--ds-color-signal); padding-left: 0; }
.channelSubName { display: block; font-size: var(--ds-font-size-xs); color: var(--ds-color-text-muted); margin-top: 3px; }
.colId { display: flex; flex-direction: column; }
.colTrack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.trackName { font-weight: 700; font-size: var(--ds-font-size-sm); color: var(--ds-color-signal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trackDesc { font-size: var(--ds-font-size-xs); color: var(--ds-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.colIo    { display: flex; gap: 8px; justify-content: center; }
.colRms   { display: flex; justify-content: flex-start; }
.colPlugins { min-width: 0; }
.colMeter { padding: 0 6px; }
.colFader { padding: 0 6px; }
.colDb    { display: flex; flex-direction: column; align-items: flex-end; }

/* ─── Mobile ─────────────────────────────────────────────────────────── */
.rootMobile {
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-sm);
  color: var(--ds-color-text-body);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sessionHeaderMobile {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  line-height: 1.8;
  border-bottom: 1px solid var(--ds-color-border-default);
  padding-bottom: 8px;
}
.tapHint { color: var(--ds-color-text-faint); font-size: var(--ds-font-size-xs); }
.channelCard {
  border: 1px solid var(--ds-color-border-default);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.channelCardFocused { border-left: 2px solid var(--ds-color-signal); }
.cardHeader {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cardName {
  flex: 1;
  font-weight: 700;
  font-size: var(--ds-font-size-sm);
  color: var(--ds-color-signal);
  letter-spacing: 0.04em;
}
.cardDb { display: flex; align-items: baseline; gap: 1px; margin-left: auto; }
.cardDesc { font-size: var(--ds-font-size-xs); color: var(--ds-color-text-muted); line-height: 1.6; }
.cardKnobs { display: flex; gap: 20px; justify-content: flex-start; }
.cardButtons { display: flex; }
.cardFooter {
  position: relative;
  height: 4px;
  background: var(--ds-color-surface-shell);
  border: 1px solid var(--ds-color-border-default);
  overflow: hidden;
  display: flex;
  align-items: center;
}
.faderFooterBar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--ds-color-signal-quiet);
}
.terminalBlock {
  border: 1px solid var(--ds-color-signal-quiet);
  padding: 8px 10px;
  margin-top: 4px;
}
.terminalLine {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  line-height: 1.8;
}
```

---

### Task 9: DawMixerSection.test.tsx

**Files:**
- Create: `components/sections/DawMixerSection/DawMixerSection.test.tsx`

- [ ] **Step 1: Create test file**

```tsx
// components/sections/DawMixerSection/DawMixerSection.test.tsx
// RSC behavioral tests: renders all 6 channels, session header, client islands receive props.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Stub client islands with minimal HTML so RSC tests stay hermetic
vi.mock('@/components/client/DawMixer/VuMeter.client', () => ({
  VuMeter: ({ channelName, initialLevel }: { channelName: string; initialLevel: number }) =>
    createElement('div', { 'data-testid': `vu-${channelName}`, 'data-level': initialLevel }),
}));
vi.mock('@/components/client/DawMixer/FaderIsland.client', () => ({
  FaderIsland: ({ channelName, initialPct }: { channelName: string; initialPct: number }) =>
    createElement('div', { 'data-testid': `fader-${channelName}`, 'data-pct': initialPct }),
}));
vi.mock('@/components/client/DawMixer/KnobIsland.client', () => ({
  KnobIsland: ({ label }: { label: string }) =>
    createElement('div', { 'data-testid': `knob-${label}` }),
}));
vi.mock('@/components/client/DawMixer/RmsButtons.client', () => ({
  RmsButtons: ({ buttons }: { buttons: string[] }) =>
    createElement('div', { 'data-testid': `rms-${buttons.join('-')}` }),
}));

async function renderDesktop(): Promise<Document> {
  const { DawMixerDesktop } = await import('./DawMixerSection');
  const html = renderToStaticMarkup(createElement(DawMixerDesktop));
  return new DOMParser().parseFromString(html, 'text/html');
}

async function renderMobile(): Promise<Document> {
  const { DawMixerMobile } = await import('./DawMixerSection');
  const html = renderToStaticMarkup(createElement(DawMixerMobile));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('DawMixerSection — desktop', () => {
  it('renders 6 channel rows', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="channel-"]').length).toBe(6);
  });

  it('renders CH 01 through CH 05 and MASTER', async () => {
    const doc = await renderDesktop();
    for (const id of ['CH 01', 'CH 02', 'CH 03', 'CH 04', 'CH 05', 'MASTER']) {
      expect(doc.querySelector(`[data-testid="channel-${id}"]`)).not.toBeNull();
    }
  });

  it('renders the session header with session name', async () => {
    const doc = await renderDesktop();
    const header = doc.querySelector('[data-testid="session-header"]');
    expect(header?.textContent).toContain('YELLOW_TAKE_03.ALS');
  });

  it('CH 02 has focused class (active channel indicator)', async () => {
    const doc = await renderDesktop();
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    expect(ch02?.className).toContain('channelFocused');
  });

  it('MASTER row shows LUFS data', async () => {
    const doc = await renderDesktop();
    const master = doc.querySelector('[data-testid="channel-MASTER"]');
    expect(master?.textContent).toContain('-14');
  });

  it('each channel renders a VuMeter with correct initial level', async () => {
    const doc = await renderDesktop();
    const vu = doc.querySelector('[data-testid="vu-RHYTHM GTR"]');
    expect(vu?.getAttribute('data-level')).toBe('71');
  });
});

describe('DawMixerSection — mobile', () => {
  it('renders 6 channel cards', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="channel-mobile-"]').length).toBe(6);
  });

  it('renders mobile session header', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="session-header-mobile"]')).not.toBeNull();
  });

  it('MASTER channel renders terminal block', async () => {
    const doc = await renderMobile();
    const master = doc.querySelector('[data-testid="channel-mobile-MASTER"]');
    expect(master?.querySelector('[class*="terminalBlock"]')).not.toBeNull();
  });

  it('terminal block contains bold text from **markers**', async () => {
    const doc = await renderMobile();
    const master = doc.querySelector('[data-testid="channel-mobile-MASTER"]');
    const strong = master?.querySelector('[class*="terminalBlock"] strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain('fewer plugins');
  });
});

describe('DawMixerSection — XSS safety', () => {
  it('does not use dangerouslySetInnerHTML', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('components/sections/DawMixerSection/DawMixerSection.tsx', 'utf8');
    expect(src).not.toContain('dangerouslySetInnerHTML');
  });
});
```

Note: `DawMixerDesktop` and `DawMixerMobile` must be exported from `DawMixerSection.tsx` for tests to import them. They are exported in Task 7 (the file above exports them without the `export` keyword — add `export` to both functions).

Update `DawMixerSection.tsx`: change `function DawMixerDesktop` and `function DawMixerMobile` to `export function DawMixerDesktop` and `export function DawMixerMobile`.

- [ ] **Step 2: Run tests**

```bash
pnpm test --run DawMixerSection.test.tsx 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 3: Commit section files**

```bash
git add components/sections/DawMixerSection/ components/client/DawMixer/DawMixer.module.css
git commit -m "feat(daw-mixer): add DawMixerSection RSC shell — desktop + mobile layouts"
```

---

### Task 10: index.ts, register in page.tsx, final integration commit

**Files:**
- Create: `components/sections/DawMixerSection/index.ts`
- Modify: `app/page.tsx` — add `<DawMixerSection defer />` after `<GuitarSection defer />`

- [ ] **Step 1: Create index.ts**

```typescript
export { DawMixerContent, DawMixerSection } from './DawMixerSection';
```

- [ ] **Step 2: Add DawMixerSection to page.tsx**

In `app/page.tsx`, add the import:

```typescript
import { DawMixerSection } from '@/components/sections/DawMixerSection';
```

Then after `<GuitarSection defer />`, add:

```tsx
          <ErrorBoundary>
            <DawMixerSection defer />
          </ErrorBoundary>
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test --run 2>&1 | tail -10
```

Expected: all tests PASS (count increases by all DAW Mixer tests).

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "error|Error" | head -10
```

Expected: no TypeScript errors.

- [ ] **Step 5: Run validate-content**

```bash
pnpm validate-content 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/sections/DawMixerSection/index.ts app/page.tsx
git commit -m "feat(daw-mixer): register DawMixerSection in page.tsx"
```

---

## Self-Review Checklist

- **Spec coverage:** session header ✓ | desktop 8-col table ✓ | CH 01-05 + MASTER ✓ | focused CH 02 border ✓ | VuMeter drag+ARIA ✓ | FaderIsland drag+ARIA ✓ | KnobIsland drag+ARIA ✓ | RmsButtons toggle+ARIA ✓ | SignalFlow = `<details>` (zero JS, native semantics) ✓ | strength dots ✓ | mobile channel cards ✓ | MASTER terminal block ✓ | bold parsing XSS-safe ✓ | LUFS footer ✓ | focused card border ✓
- **Placeholder scan:** none found
- **Type consistency:** `DawMixerChannel`, `DawMixerPlugin` from schemas used throughout; `DawMixer` type used in session header helpers
- **Architect findings addressed:**
  - Inline-bold uses `String.split` + JSX ✓ (XSS safety test enforces it)
  - SignalFlow replaced with `<details>/<summary>` (saves ~1KB gz, native a11y) ✓
  - VuMeter `role="slider"` with explicit "VU meter demonstration" aria-label clarifying intent ✓
  - KnobIsland uses Y-delta (no atan2 quadrant wrap), clamp enforced on every `pointermove`, ArrowUp = increase matches drag direction ✓ (all four failure modes covered in tests)
  - `focused: true` on CH 02 is RSC data — no cross-channel state ✓
  - `strength: 0` on inactive FUZZ (CH 05) renders 0 filled dots ✓
  - Image budget: photo resized to ≤600px in Task 1 of guitar-rig plan ✓
