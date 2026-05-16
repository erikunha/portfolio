# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 21 findings from the 2026-05-16 quality audit in five sequential thematic commits, each leaving `pnpm ci:local` green.

**Architecture:** No new abstractions or files beyond what the spec defines. Every fix is a targeted edit: content migrations use existing Zod schemas, motion fixes use the existing `readMotion()` API, API fixes use Upstash's built-in pipeline, type-safety fixes bind local consts after the existing null guards.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Biome · Upstash Redis · pnpm

---

## Task 1 — Content migration (findings #5, #10)

**Files:**
- Create: `content/readme.ts`
- Create: `content/dmesg.ts`
- Modify: `content/schemas.ts`
- Modify: `content/man-page.ts`
- Modify: `content/guitar-rig.ts`
- Modify: `content/hottest-takes.ts`
- Modify: `components/sections/ReadmeSection.tsx`
- Modify: `components/sections/Footer.tsx`
- Modify: `components/sections/VisaSection.tsx`
- Modify: `components/sections/GuitarSection.tsx`
- Modify: `components/sections/ManPageSection.tsx`
- Modify: `components/sections/HottestTakesSection.tsx`
- Modify: `components/sections/UnknownsSection.tsx`
- Modify: `components/sections/ResponsibilitiesSection.tsx`
- Modify: `components/sections/CredentialsSection.tsx`
- Modify: `app/not-found.tsx`

---

### Step 1.1 — Extend `content/schemas.ts`

- [ ] Open `content/schemas.ts`. Add the following schemas **before** the closing line (do not touch existing schemas):

```ts
// ReadmeSection — prose copy extracted from JSX
export const ReadmeCopySchema = z.object({
  desktopH1: z.string(),
  desktopIntro: z.string(),
  desktopCoreStack: z.array(z.string()).min(1),
  desktopPrinciples: z.array(z.string()).min(1),
  desktopStatusH2: z.string(),
  mobileH2: z.string(),
  mobileBetssonPrefix: z.string(),
  mobileBetssonSuffix: z.string(),
  mobileCoreStack: z.array(z.string()).min(1),
  mobilePrinciples: z.array(z.string()).min(1),
  mobileStatusSuffix: z.string(),
});
export type ReadmeCopy = z.infer<typeof ReadmeCopySchema>;

// Footer DMESG — structured so no JSX lives in content
export const DmesgLineSchema = z.object({
  off: z.number(),
  prefix: z.string(),
  bold: z.string().optional(),
  suffix: z.string().optional(),
  ok: z.boolean(),
});
export type DmesgLine = z.infer<typeof DmesgLineSchema>;
```

- [ ] In `content/schemas.ts`, update `ManPageSchema` to rename `descriptionMobile` → `description`:

```ts
export const ManPageSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  version: z.string(),
  date: z.string(),
  description: z.string(),
  options: z.array(z.object({ flag: z.string(), desc: z.string() })),
  knownBugs: z.array(z.string()),
});
```

- [ ] In `content/schemas.ts`, update `GuitarFieldSchema` to add optional mobile variants:

```ts
export const GuitarFieldSchema = z.object({
  label: z.string(),
  labelMobile: z.string().optional(),
  value: z.string(),
  valueMobile: z.string().optional(),
});
```

- [ ] Run `pnpm validate-content` — it should **fail** (the old `descriptionMobile` field is gone). That is expected; the fix is in the next steps.

---

### Step 1.2 — Create `content/readme.ts`

- [ ] Create `content/readme.ts`:

```ts
import { type ReadmeCopy, ReadmeCopySchema } from './schemas';

export const readmeCopy: ReadmeCopy = ReadmeCopySchema.parse({
  desktopH1: '# Erik Henrique Alves Cunha — Full-Stack Engineer (Frontend-Heavy)',
  desktopIntro:
    '8+ years building frontend systems for regulated, high-traffic platforms in fintech (PCI-DSS), healthcare, and global e-commerce.',
  desktopCoreStack: [
    '- Angular · React · Next.js · TypeScript · Node.js · RxJS · NgRx',
    '- Micro-frontends · Nx monorepos · Clean Architecture · Web Components',
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
```

---

### Step 1.3 — Create `content/dmesg.ts`

- [ ] Create `content/dmesg.ts`:

```ts
import { z } from 'zod';
import { type DmesgLine, DmesgLineSchema } from './schemas';

export const dmesgLines: DmesgLine[] = z.array(DmesgLineSchema).parse([
  { off: 0.001, prefix: 'init: switching runlevel to 0', ok: false },
  { off: 0.142, prefix: 'systemd: stopping ', bold: 'matrix_rain.daemon', ok: true },
  { off: 0.213, prefix: 'systemd: stopping ', bold: 'crt_flicker.service', ok: true },
  { off: 0.288, prefix: 'kernel: tcp: closing ', bold: '3', suffix: ' connections', ok: true },
  { off: 0.401, prefix: 'systemd: reached target ', bold: 'Shutdown', suffix: '.', ok: false },
  { off: 0.502, prefix: 'systemd: reached target ', bold: 'Final Step', suffix: '.', ok: false },
  { off: 0.601, prefix: 'kernel: ', bold: 'Power down.', ok: false },
]);
```

---

### Step 1.4 — Update `content/man-page.ts`

- [ ] Open `content/man-page.ts`. Replace `descriptionMobile:` with `description:`. No other change.

```ts
import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'full-stack engineer (frontend-heavy)',
  version: 'v8.0',
  date: '2026-05-15',
  description:
    'Senior frontend engineer, 8+ years. Shipped production systems across payments (PCI-DSS), healthcare, e-commerce, and ed-tech. Angular, React/Next.js, Stencil micro-frontends powering €1B+ in revenue. 12-agent AI platform in production. Currently at Betsson (Malta, EU).',
  options: [
    { flag: '--seniority', desc: 'Senior → Staff/Principal' },
    { flag: '--track', desc: 'IC or technical lead' },
    { flag: '--domain', desc: 'Payments, healthcare, AI tooling' },
    { flag: '--region', desc: 'Worldwide; remote-first' },
    { flag: '--relocation', desc: 'Open to relocating' },
    { flag: '--regulated', desc: 'PCI-DSS, healthcare, banking' },
    { flag: '--contract', desc: 'Fixed-term or freelance' },
    { flag: '--ft', desc: 'Full-time' },
    { flag: '--hire', desc: 'Initiates handshake. See CONTACT.' },
  ],
  knownBugs: [
    'Occasionally rewrites a working component for clarity.',
    'Will not stop talking about bundle size.',
    'Sometimes ships the test before the feature.',
  ],
});
```

---

### Step 1.5 — Update `content/guitar-rig.ts`

- [ ] Open `content/guitar-rig.ts`. Add `labelMobile` and `valueMobile` where the mobile display differs from desktop:

```ts
import { type GuitarRig, GuitarRigSchema } from './schemas';

export const guitarRig: GuitarRig = GuitarRigSchema.parse({
  comment: '# updated 2026-05-13',
  commentMobile: '# the other six strings',
  fields: [
    {
      label: 'GUITAR_MAIN',
      labelMobile: 'MAIN',
      value: 'Gretsch G5655TG · Electromatic Center Block Jr · Bigsby',
      valueMobile: 'Gretsch G5655TG · Bigsby',
    },
    { label: 'GUITAR_ALT', labelMobile: 'ALT', value: 'Martin acoustic' },
    {
      label: 'AMP',
      value: 'modeled · no tube in the chain',
      valueMobile: 'modeled · no tube',
    },
    {
      label: 'PEDALBOARD',
      labelMobile: 'PEDAL',
      value: 'Line 6 HX Stomp XL · amp + effects modeling',
      valueMobile: 'Line 6 HX Stomp XL',
    },
    {
      label: 'STYLE',
      value: 'feel / expression over noise · clean tones, lots of space',
      valueMobile: 'feel over noise · lots of space',
    },
    {
      label: 'TUNING',
      value: 'standard E · sometimes drop D · never Eb',
      valueMobile: 'standard E · sometimes drop D',
    },
    {
      label: 'PRACTICE',
      value: 'jams, tones, live takes · guitarcam',
      valueMobile: 'jams · tones · live takes',
    },
    {
      label: 'GIGS',
      value: 'weddings · small venues ·  open mics',
      valueMobile: 'weddings · small venues ·  open mics',
    },
    {
      label: 'NEVER_LEARNED',
      labelMobile: 'NEVER_LRND',
      value: 'reading staff notation · tabs only',
      valueMobile: 'tabs only · no staff notation',
    },
    {
      label: 'LATEST_OBSESSION',
      labelMobile: 'OBSESSION',
      value: "Coldplay's \"Yellow\" — the simplicity is the hard part",
      valueMobile: "Coldplay's \"Yellow\" · simplicity is hard",
    },
  ],
  influences: [
    { rank: 1, name: 'John Mayer' },
    { rank: 2, name: 'Mateus Asato' },
    { rank: 3, name: 'Jimmy Page' },
    { rank: 4, name: 'John Frusciante' },
    { rank: 5, name: "Iron Maiden's three (Murray · Smith · Gers)" },
  ],
  influencesMobile: [
    { rank: 1, name: 'John Mayer' },
    { rank: 2, name: 'Mateus Asato' },
    { rank: 3, name: 'Jimmy Page' },
    { rank: 4, name: 'John Frusciante' },
    { rank: 5, name: "Iron Maiden's three" },
  ],
});
```

> **Note:** `GuitarRigSchema` also needs `commentMobile` and `influencesMobile` fields added. Update the schema in `content/schemas.ts`:
>
> ```ts
> export const GuitarRigSchema = z.object({
>   comment: z.string(),
>   commentMobile: z.string(),
>   fields: z.array(GuitarFieldSchema).min(1),
>   influences: z.array(GuitarInfluenceSchema).min(1),
>   influencesMobile: z.array(GuitarInfluenceSchema).min(1),
> });
> ```

- [ ] Run `pnpm validate-content` — should pass now for guitar-rig. The man-page `description` rename is also fixed. Validate passes if all schema checks succeed.

---

### Step 1.6 — Update `content/hottest-takes.ts`

- [ ] Open `content/hottest-takes.ts`. Add a `config` export at the bottom (after the existing `hottestTakes` export):

```ts
export const hottestTakesConfig = {
  preamble: "// opinions i'll defend in a whiteboard interview",
  footer: 'willing to be wrong on any of these. willing to argue first.',
} as const;
```

---

### Step 1.7 — Update `components/sections/ReadmeSection.tsx`

- [ ] Replace the `README_DESKTOP` and `README_MOBILE` inline arrays with imports from `content/readme`. The node entries (which use `<span className="pill">` and `<RoleTyper />`) must stay in the component. Full updated file:

```tsx
import type { ReactNode } from 'react';
import { readmeCopy as c } from '@/content/readme';
import { RoleTyper } from '../client/RoleTyper';
import { IconReadme } from '../Icons';
import { Module } from '../responsive/Module';

type ReadmeLine = { text?: string; node?: ReactNode; cls?: string };

const README_DESKTOP: ReadmeLine[] = [
  { text: c.desktopH1, cls: 'h1' },
  { text: c.desktopIntro },
  { text: '## Core Stack', cls: 'h2' },
  ...c.desktopCoreStack.map((t) => ({ text: t })),
  { text: '## Operating Principles', cls: 'h2' },
  ...c.desktopPrinciples.map((t) => ({ text: t })),
  { text: c.desktopStatusH2, cls: 'h2' },
  {
    node: (
      <>
        {'Open to '}
        <span className="pill">{'[Senior / Staff / Principal]'}</span>
        {' roles or impactful contract roles · remote-first · EU/US/CA · English C1.'}
      </>
    ),
  },
];

const README_MOBILE: ReadmeLine[] = [
  { text: c.mobileH2, cls: 'h2' },
  { text: ' ' },
  { text: 'full-stack engineer (frontend-heavy). 8+ yrs.' },
  {
    node: (
      <>
        {c.mobileBetssonPrefix}
        <span className="pill">{'betsson'}</span>
        {' cashier — 40M+ tx/yr,'}
      </>
    ),
  },
  { text: c.mobileBetssonSuffix },
  { text: ' ' },
  { text: '## core stack', cls: 'h2' },
  ...c.mobileCoreStack.map((t) => ({ text: t })),
  { text: ' ' },
  { text: '## operating principles', cls: 'h2' },
  ...c.mobilePrinciples.map((t) => ({ text: t })),
  { text: ' ' },
  { text: '## status', cls: 'h2' },
  {
    node: (
      <>
        {'open to '}
        <RoleTyper />
        {' roles.'}
      </>
    ),
  },
  { text: c.mobileStatusSuffix },
];

function ReadmeBlock({ lines }: { lines: ReadmeLine[] }) {
  return (
    <div className="readme">
      <div className="readme__gutter" aria-hidden="true">
        {lines.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <div className="readme__code">
        {lines.map((line, i) => (
          <div
            key={i}
            className={line.cls ? `readme__row readme__row--${line.cls}` : 'readme__row'}
          >
            {line.node ?? line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReadmeSection() {
  return (
    <Module id="sec-readme" header="CAT README.MD" icon={<IconReadme />}>
      <div className="readme--desktop">
        <ReadmeBlock lines={README_DESKTOP} />
      </div>
      <div className="readme--mobile">
        <ReadmeBlock lines={README_MOBILE} />
      </div>

      <div className="readme-codesample">
        <div className="codesample">
          <div className="codesample__bar">
            <span>{'$ cat src/lib/with-retry.ts'}</span>
            <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
              {'// view full repo →'}
            </a>
          </div>
          <pre className="codesample__pre">
            <span className="tk-c">
              {'// retry an RxJS stream with exponential backoff + jitter — used in'}
            </span>
            {'\n'}
            <span className="tk-c">
              {"// the cashier's deposit polling loop. signals abort on permanent 4xx."}
            </span>
            {'\n'}
            <span className="tk-k">{'export function'}</span>{' '}
            <span className="tk-f">{'withRetry'}</span>
            <span className="tk-p">{'<'}</span>
            <span className="tk-t">{'T'}</span>
            <span className="tk-p">{'>'}</span>
            <span className="tk-p">{'('}</span>
            {'\n'}
            {'  '}
            <span className="tk-p">{'{ max = '}</span>
            <span className="tk-t">{'5'}</span>
            <span className="tk-p">{', base = '}</span>
            <span className="tk-t">{'300'}</span>
            <span className="tk-p">{', isFatal }: '}</span>
            <span className="tk-t">{'RetryOpts'}</span>
            <span className="tk-p">{','}</span>
            {'\n'}
            <span className="tk-p">{'): '}</span>
            <span className="tk-t">{'MonoTypeOperatorFunction'}</span>
            <span className="tk-p">{'<'}</span>
            <span className="tk-t">{'T'}</span>
            <span className="tk-p">{'> {'}</span>
            {'\n'}
            {'  '}
            <span className="tk-k">{'return'}</span> <span className="tk-f">{'retry'}</span>
            <span className="tk-p">{'({'}</span>
            {'\n'}
            {'    count'}
            <span className="tk-p">{':'}</span>
            {' max'}
            <span className="tk-p">{','}</span>
            {'\n'}
            {'    delay'}
            <span className="tk-p">{': (err, attempt) => {'}</span>
            {'\n'}
            {'      '}
            <span className="tk-k">{'if'}</span> <span className="tk-p">{'('}</span>
            <span className="tk-f">{'isFatal'}</span>
            <span className="tk-p">{'?.(err)) '}</span>
            <span className="tk-k">{'throw'}</span>
            {' err'}
            <span className="tk-p">{';'}</span>
            {'\n'}
            {'      '}
            <span className="tk-k">{'const'}</span>
            {' wait '}
            <span className="tk-p">{'='}</span>
            {' base '}
            <span className="tk-p">{'* '}</span>
            <span className="tk-t">{'2'}</span>
            <span className="tk-p">{'**'}</span>
            {'attempt '}
            <span className="tk-p">{'+ '}</span>
            <span className="tk-f">{'Math.random'}</span>
            <span className="tk-p">{'() * '}</span>
            {'base'}
            <span className="tk-p">{';'}</span>
            {'\n'}
            {'      '}
            <span className="tk-k">{'return'}</span> <span className="tk-f">{'timer'}</span>
            <span className="tk-p">{'(wait);'}</span>
            {'\n'}
            {'    '}
            <span className="tk-p">{'}'}</span>
            <span className="tk-p">{','}</span>
            {'\n'}
            {'  '}
            <span className="tk-p">{'});'}</span>
            {'\n'}
            <span className="tk-p">{'}'}</span>
          </pre>
        </div>
      </div>
    </Module>
  );
}
```

---

### Step 1.8 — Update `components/sections/Footer.tsx`

- [ ] At the top of `Footer.tsx`, replace the inline `DMESG` const (lines 22–78) with an import, and update the render to use structured data. The `DmesgLine` type becomes the imported schema type:

Replace lines 1–4 (imports block):
```tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { dmesgLines } from '@/content/dmesg';
import { MatrixRain } from '@/components/responsive/MatrixRain';
import { useBreakpoint } from '@/lib/use-breakpoint';
```

Remove the old `type DmesgLine` definition and the entire `const DMESG: DmesgLine[]` array (lines 20–78).

Update the state declaration that references `DMESG` — replace every `DMESG` reference with `dmesgLines`:

```ts
const [dmesgOn, setDmesgOn] = useState<boolean[]>(dmesgLines.map(() => false));
const [dmesgTs, setDmesgTs] = useState<string[]>(dmesgLines.map(() => ''));
```

In the IntersectionObserver effect, replace `DMESG` with `dmesgLines`:
```ts
const ts = dmesgLines.map(({ off }) => {
  const t = (base + off).toFixed(3).padStart(9, ' ');
  return `[${t}]`;
});
setDmesgTs(ts);
dmesgLines.forEach((_, i) => {
  setTimeout(() => {
    setDmesgOn((prev) => prev.map((v, j) => (j === i ? true : v)));
    if (i === dmesgLines.length - 1) setTimeout(() => setHaltOn(true), 180);
  }, i * 80);
});
```

Update the `<ul>` render to use structured data (replacing `line.msg` with structured spans):
```tsx
<ul className="sd-dmesg" aria-label="kernel buffer tail">
  {dmesgLines.map((line, i) => (
    <li key={line.off} className={dmesgOn[i] ? 'dm-line on' : 'dm-line'}>
      <span className="dm-t">{dmesgTs[i]}</span>
      <span className="dm-msg">
        {line.prefix}
        {line.bold && <b>{line.bold}</b>}
        {line.suffix}
      </span>
      {line.ok && <span className="dm-ok">OK</span>}
      {!line.ok && <span className="dm-ok" aria-hidden="true" />}
    </li>
  ))}
</ul>
```

---

### Step 1.9 — Update `components/sections/VisaSection.tsx`

- [ ] Replace inline table data with imports from `content/visa`. Full updated file:

```tsx
import { visaRows } from '@/content/visa';
import { IconVisa } from '../Icons';
import { Module } from '../responsive/Module';

export function VisaSection() {
  return (
    <Module
      id="sec-visa"
      header="CAT ~/.VISA"
      mobileHeader="CAT ~/.VISA & .CREDENTIALS"
      icon={<IconVisa />}
      defaultOpen={false}
    >
      <div className="visa">
        <pre className="visa-desktop-pre">
          <span className="vh">{'JURISDICTION    STATUS                  EVIDENCE'}</span>
          {'\n'}
          <span className="vrule">
            {'================================================================'}
          </span>
          {'\n'}
          {visaRows.map((row) => (
            <span key={row.jurisdiction}>
              <span className="vjur">{row.jurisdiction.padEnd(16)}</span>
              <span className="vstat">{row.status.padEnd(24)}</span>
              <span className="vev">{row.evidence}</span>
              {'\n'}
            </span>
          ))}
        </pre>

        <pre className="visa-mobile-pre">
          <span className="cmd-line">
            <span className="pr">$</span>
            {' cat ~/.visa'}
          </span>
          {'\n\n'}
          <span className="vh">{'REGION    STATUS'}</span>
          {'\n'}
          <span className="vrule">{'================================'}</span>
          {'\n'}
          {visaRows.map((row) => (
            <span key={row.jurisdictionShort}>
              <span className="vjur">{row.jurisdictionShort}</span>
              {'   '}
              <span className="vstat">{row.statusShort}</span>
              {'\n          '}
              <span className="vev">{row.evidence}</span>
              {'\n'}
            </span>
          ))}
        </pre>

        <div className="visa-foot">{'// PT (native) · EN (C1) · FR (A2) · ES (A2)'}</div>
      </div>

      <div className="visa-mobile-creds">
        <pre>
          <span className="cmd-line">
            <span className="pr">$</span>
            {' cat ~/.credentials'}
          </span>
          {'\n\n'}
          <span className="cr-label">{'ANGULAR_DEV'}</span>
          {'  '}
          <span className="cr-badge">{'CERTIFIED'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'Alain Chautard (GDE) · 2024'}</span>
          {'\n'}
          <span className="cr-label">{'ENGLISH'}</span>
          {'      '}
          <span className="cr-badge">{'IELTS_C1'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'band 6.5 · 2023'}</span>
          {'\n'}
          <span className="cr-label">{'INTL_DEGREE'}</span>
          {'  '}
          <span className="cr-badge">{'WES_VERIFIED'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'World Education Svcs · 2022'}</span>
        </pre>
      </div>
    </Module>
  );
}
```

> The `visa-mobile-creds` block still has some inline strings (badge labels). Those are UI chrome labels, not prose content. If the reviewer flags them, also pull in `credentials` from `content/credentials` and render from data there too (same map pattern as CredentialsSection below).

---

### Step 1.10 — Update `components/sections/GuitarSection.tsx`

- [ ] Replace all hardcoded content with imports from `content/guitar-rig`. Full updated file:

```tsx
import { guitarRig } from '@/content/guitar-rig';
import { IconGuitar } from '../Icons';
import { Module } from '../responsive/Module';

export function GuitarSection() {
  return (
    <Module id="sec-guitar" header="CAT ~/.GUITAR_RIG" icon={<IconGuitar />} defaultOpen={false}>
      <div className="visa">
        <pre className="guitar-desktop">
          <span className="cmd-line">
            <span className="pr">$</span>
            {'cat ~/.guitar_rig'}
          </span>
          {'\n'}
          <span className="gr-comment">{guitarRig.comment}</span>
          {'\n\n'}
          {guitarRig.fields.map((f) => (
            <span key={f.label}>
              <span className="gr-label">{f.label}</span>
              {'  '}
              <span className="gr-val">{f.value}</span>
              {'\n'}
            </span>
          ))}
          {'\n'}
          <span className="gr-label">{'INFLUENCES'}</span>
          {'        '}
          <span className="gr-val">{'in order:'}</span>
          {'\n'}
          {guitarRig.influences.map((inf) => (
            <span key={inf.rank}>
              {'                      '}
              <span className="gr-num">{`${inf.rank}.`}</span>{' '}
              <span className="gr-name">{inf.name}</span>
              {'\n'}
            </span>
          ))}
        </pre>

        <pre
          className="guitar-mobile"
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.7 }}
        >
          <span className="cmd-line">
            <span className="pr">$</span>
            {'cat ~/.guitar_rig'}
          </span>
          {'\n'}
          <span className="gr-comment">{guitarRig.commentMobile}</span>
          {'\n\n'}
          {guitarRig.fields.map((f) => (
            <span key={f.labelMobile ?? f.label}>
              <span className="gr-label">{f.labelMobile ?? f.label}</span>
              {'  '}
              <span className="gr-val">{f.valueMobile ?? f.value}</span>
              {'\n'}
            </span>
          ))}
          {'\n'}
          <span className="gr-label">{'INFLUENCES'}</span>
          {'\n'}
          {guitarRig.influencesMobile.map((inf) => (
            <span key={inf.rank}>
              {'              '}
              <span className="gr-num">{`${inf.rank}.`}</span>{' '}
              <span className="gr-name">{inf.name}</span>
              {'\n'}
            </span>
          ))}
        </pre>
      </div>
    </Module>
  );
}
```

> Note: The desktop view previously had exact character-count padding for column alignment (e.g. `'GUITAR_MAIN'` + 7 spaces). The data-driven render uses `{'  '}` (2 spaces) instead. If the reviewer requires precise column alignment, add a `labelPad` field to `GuitarFieldSchema` or use CSS `grid` layout. For now, 2 spaces is acceptable since the section already has a mono font.

---

### Step 1.11 — Update `components/sections/ManPageSection.tsx`

- [ ] In `ManPageSection.tsx`, the desktop `DESCRIPTION` block is hardcoded as a template literal on lines 36–43. Replace with `{manPage.description}`:

In the desktop `<pre>` block, replace:
```tsx
<span className="m-sec">{'DESCRIPTION'}</span>
{`\n       Senior frontend engineer, 8+ years. Started full-stack,
       evolved into frontend architecture. Shipped production
       systems across payments (PCI-DSS), healthcare, banking,
       e-commerce, and ed-tech — Angular, React/Next.js, and
       Stencil micro-frontends powering €1B+ in revenue.
       Ranges across web, mobile (Ionic), and desktop (Electron).
       Recently built a 12-agent AI engineering platform in
       production. Currently embedded at Betsson (Malta, EU).\n\n`}
```

With:
```tsx
<span className="m-sec">{'DESCRIPTION'}</span>
{`\n       `}
{manPage.description}
{'\n\n'}
```

The mobile block already uses `{manPage.descriptionMobile}`. Update it to use `{manPage.description}` (the field was renamed in Step 1.4):
```tsx
<span className="mp-sec">DESCRIPTION</span>
<span className="mp-body">{manPage.description}</span>
```

---

### Step 1.12 — Update `components/sections/HottestTakesSection.tsx`

- [ ] Import `hottestTakesConfig` and replace the two hardcoded strings:

```tsx
import { hottestTakes, hottestTakesConfig } from '@/content/hottest-takes';
import { IconHottestTakes } from '../Icons';
import { Module } from '../responsive/Module';

export function HottestTakesSection() {
  return (
    <Module
      id="sec-hottest-takes"
      header="CAT ~/HOTTEST_TAKES.MD"
      icon={<IconHottestTakes />}
      defaultOpen={false}
    >
      <div className="takes__preamble">
        <span className="gt">$</span>
        {'cat ~/hottest_takes.md  '}
        <span style={{ opacity: 0.55 }}>{hottestTakesConfig.preamble}</span>
      </div>
      <ol className="takes" start={1}>
        {hottestTakes.map((t) => (
          <li key={t.num} className="take">
            <span className="take__num">{t.num}</span>
            <div className="take__content">
              <p className="take__thesis">
                <span className="take__category">{t.category}</span>
                {t.thesis}
              </p>
              <p className="take__body">{t.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="takes__footer">
        <span className="gt">{'>'}</span>
        {hottestTakesConfig.footer}
      </div>
    </Module>
  );
}
```

---

### Step 1.13 — Update `components/sections/UnknownsSection.tsx`

- [ ] `content/unknowns.ts` already has all the data with full `UnknownsSchema` validation. Replace the entire hardcoded `<pre>` block with data-driven rendering:

```tsx
import { unknowns } from '@/content/unknowns';
import { IconUnknowns } from '../Icons';
import { Module } from '../responsive/Module';

export function UnknownsSection() {
  return (
    <Module id="sec-unknowns" header="CAT ~/.UNKNOWNS" icon={<IconUnknowns />} defaultOpen={false}>
      <div className="unknowns">
        <pre>
          <span className="uk-cmd">
            <span className="gt">$</span>
            {' cat ~/.unknowns'}
          </span>
          {'\n\n'}
          <span className="uk-h">{"# things i'm actively learning"}</span>
          {'\n\n'}
          {unknowns.learning.map((item) => (
            <span key={item.claim}>
              <span className="uk-bul">{'-'}</span>
              {` ${item.claim}\n`}
              <span className="uk-mute">{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className="uk-h">{"# things i've chosen not to specialize in (yet)"}</span>
          {'\n\n'}
          {unknowns.notSpecializing.map((item) => (
            <span key={item.claim}>
              <span className="uk-bul">{'-'}</span>
              {` ${item.claim}\n`}
              <span className="uk-mute">{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className="uk-open">{unknowns.footer}</span>
        </pre>
      </div>
    </Module>
  );
}
```

---

### Step 1.14 — Update `components/sections/ResponsibilitiesSection.tsx`

- [ ] `content/responsibilities.ts` already has all data. Replace the hardcoded `<pre>` block:

```tsx
import { responsibilities } from '@/content/responsibilities';
import { IconResponsibilities } from '../Icons';
import { Module } from '../responsive/Module';

export function ResponsibilitiesSection() {
  return (
    <Module
      id="sec-responsibilities"
      header="LS -LA ~/RESPONSIBILITIES"
      icon={<IconResponsibilities />}
      defaultOpen={false}
    >
      <div className="permatrix">
        <div className="pm-cmd">
          <span className="gt">$</span>
          {'ls -la ~/responsibilities  '}
          <span style={{ opacity: 0.55 }}>{'// role boundaries, in unix terms'}</span>
        </div>
        <pre>
          {responsibilities.map((r) => (
            <span key={r.name}>
              <span className="pm-perm">{r.perms}</span>
              {'  '}
              <span className="pm-user">{r.user}</span>
              {'  '}
              <span className="pm-group">{r.group}</span>
              {'  '}
              <span className={`pm-file${r.highlight ? ' crit' : ''}`}>{r.name}</span>
              {'\n'}
            </span>
          ))}
        </pre>
        <div className="pm-foot">
          <span>
            <span className="pm-k">drwxr-xr-x</span>
            {'  i own it, you can read it, you can run against it'}
          </span>
          <span>
            <span className="pm-k">drwxrwxrwx</span>
            {'  explicitly shared — please write here too'}
          </span>
          <span>
            <span className="pm-k">drwxr-x---</span>
            {'  owned, run only by trusted group (security, compliance)'}
          </span>
          <span>
            <span className="pm-k">-rwx------</span>
            {'  not delegable; this is the one i bring to the room'}
          </span>
        </div>
      </div>
    </Module>
  );
}
```

---

### Step 1.15 — Update `components/sections/CredentialsSection.tsx`

- [ ] `content/credentials.ts` already has all data. Replace the hardcoded `<pre>` block:

```tsx
import { credentials } from '@/content/credentials';
import { IconCredentials } from '../Icons';
import { Module } from '../responsive/Module';

export function CredentialsSection() {
  return (
    <Module
      id="sec-credentials"
      header="CAT ~/.CREDENTIALS"
      icon={<IconCredentials />}
      defaultOpen={false}
    >
      <div className="visa">
        <pre>
          <span className="cmd-line">
            <span className="pr">$</span>
            {'cat ~/.credentials'}
          </span>
          {'\n\n'}
          {credentials.map((cred) => (
            <span key={cred.label}>
              <span className="cr-label">{cred.label}</span>
              {'     '}
              <span className="cr-badge">{cred.badge}</span>
              {'       '}
              <span className="cr-val">{cred.evidence}</span>
              {'\n'}
            </span>
          ))}
        </pre>
      </div>
    </Module>
  );
}
```

---

### Step 1.16 — Fix `app/not-found.tsx`

- [ ] Remove the `CRTOverlay` import and usage (eliminates a client island on the 404 page). The text strings are short enough to stay inline:

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found">
      <pre style={{ lineHeight: 1.8, fontSize: 'clamp(0.8rem, 2vw, 1rem)' }}>
        <span style={{ color: 'var(--signal)', opacity: 0.6 }}>{'erik@portfolio:~$ '}</span>
        <span>{'navigate /dev/null'}</span>
        {'\n'}
        <span>{'bash: navigate: /dev/null: Not a directory'}</span>
        {'\n\n'}
        <span style={{ color: 'var(--signal)' }}>{'ERROR 404 — PAGE_NOT_FOUND'}</span>
        {'\n\n'}
        <Link
          href="/"
          style={{
            color: 'var(--signal)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--signal)',
          }}
        >
          {'← cd ~'}
        </Link>
        <span style={{ opacity: 0.5 }}>{'  ·  return to portfolio'}</span>
      </pre>
    </main>
  );
}
```

---

### Step 1.17 — Verify and commit

- [ ] Run: `pnpm validate-content`

  Expected: all schemas pass, no Zod errors.

- [ ] Run: `pnpm ci:local`

  Expected: zero errors. If Biome flags any issue, fix it before committing.

- [ ] Spot-check each migrated section renders correctly at `http://localhost:3000` (run `pnpm dev`):
  - VisaSection, CredentialsSection, ResponsibilitiesSection, UnknownsSection — compare against previous screenshots
  - GuitarSection desktop vs mobile
  - ManPageSection DESCRIPTION on desktop and mobile
  - Footer DMESG animation
  - 404 page (navigate to `/nonexistent`) — no CRTOverlay, text renders correctly

- [ ] Commit:

```bash
git add content/readme.ts content/dmesg.ts content/schemas.ts content/man-page.ts \
        content/guitar-rig.ts content/hottest-takes.ts \
        components/sections/ReadmeSection.tsx components/sections/Footer.tsx \
        components/sections/VisaSection.tsx components/sections/GuitarSection.tsx \
        components/sections/ManPageSection.tsx components/sections/HottestTakesSection.tsx \
        components/sections/UnknownsSection.tsx components/sections/ResponsibilitiesSection.tsx \
        components/sections/CredentialsSection.tsx app/not-found.tsx
git commit -m "feat(content): migrate all inline copy to typed content modules, fix not-found CRTOverlay"
```

---

## Task 2 — Motion & a11y (findings #2, #4, #7, #9, #21)

**Files:**
- Modify: `components/sections/Hero.tsx`
- Modify: `components/responsive/MatrixRain.tsx`
- Modify: `components/client/RoleTyper.tsx`
- Modify: `components/client/InteractiveShell.tsx` (AnimatedPlaceholder only)
- Modify: `components/sections/Footer.tsx`
- Modify: `components/responsive/StatusBar.tsx`
- Modify: `components/client/ContactForm.tsx`
- Modify: `app/page.tsx`
- Modify: `app/css/_base.css`

---

### Step 2.1 — Fix motion toggle in `MatrixRain.tsx`

- [ ] In `MatrixRain.tsx`, line 34, replace the raw `matchMedia` call with `readMotion()`:

```ts
// Add to imports at top:
import { readMotion } from '@/lib/motion';

// Replace line 34:
if (!readMotion()) return;
```

---

### Step 2.2 — Fix motion toggle in `Hero.tsx`

- [ ] In `Hero.tsx`, add `readMotion` import at the top:

```ts
import { readMotion } from '@/lib/motion';
```

- [ ] In `DesktopHero` `useEffect` (line 251), replace:

```ts
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
```

With:

```ts
if (!readMotion()) {
```

- [ ] In `MobileHero` `useEffect` (line 369), replace:

```ts
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
```

With:

```ts
if (!readMotion()) {
```

---

### Step 2.3 — Fix motion toggle in `RoleTyper.tsx`

- [ ] In `RoleTyper.tsx`, replace the `window.matchMedia` check at line 19 with `readMotion()`. Open the file and apply:

```ts
import { readMotion } from '@/lib/motion';
// ...
if (!readMotion()) {
  // static fallback
  return;
}
```

---

### Step 2.4 — Fix motion toggle in `InteractiveShell.tsx` (AnimatedPlaceholder)

- [ ] In `InteractiveShell.tsx`, the `AnimatedPlaceholder` component (lines 47–95) has a `window.matchMedia` check at line 53. Add `readMotion` import and replace:

```ts
import { readMotion } from '@/lib/motion';
// ...
// Inside AnimatedPlaceholder's useEffect (line 53):
if (!readMotion()) {
  node.textContent = 'type a command or ask anything…';
  return;
}
```

---

### Step 2.5 — Add visibility pause to Hero dialog

- [ ] In `DesktopHero` `useEffect`, the `ctrl` variable is assigned from `runBoot(...)` at line 259. Add `visibilitychange` subscription immediately after `ctrl` is assigned, before setting `bootCtrl.current`:

```ts
const ctrl = runBoot(el, DESKTOP_LINE_SPECS, DESKTOP_DIALOG, {
  // ... options unchanged ...
});

const onVisibility = () => {
  if (document.hidden) ctrl.pauseDialog();
  else ctrl.resumeDialog();
};
document.addEventListener('visibilitychange', onVisibility);

bootCtrl.current = ctrl;
return () => {
  ctrl.cancel();
  document.removeEventListener('visibilitychange', onVisibility);
};
```

This replaces the existing `return ctrl.cancel;` cleanup line.

---

### Step 2.6 — Add visibility pause to Footer clock

- [ ] In `Footer.tsx`, replace the clock `useEffect` (lines 94–101) with a version that pauses on `hidden`:

```ts
useEffect(() => {
  let id: ReturnType<typeof setInterval> | null = null;

  function tick() {
    const s = Math.floor((Date.now() - uptimeRef.current) / 1000);
    setUptime(fmtUptime(s));
    setTime(fmtClock(new Date()));
  }

  function startClock() {
    id = setInterval(tick, 1000);
  }

  function onVisibility() {
    if (document.hidden) {
      if (id !== null) { clearInterval(id); id = null; }
    } else {
      startClock();
    }
  }

  startClock();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    if (id !== null) clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}, []);
```

---

### Step 2.7 — Add visibility pause to StatusBar clock

- [ ] In `StatusBar.tsx`, replace the `useEffect` with a version that pauses on `hidden`. Full updated file:

```tsx
'use client';

import { useEffect, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatusBar() {
  const [time, setTime] = useState(() => fmtClock(new Date()));

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function startClock() {
      setTime(fmtClock(new Date()));
      id = setInterval(() => setTime(fmtClock(new Date())), 15_000);
    }

    function onVisibility() {
      if (document.hidden) {
        if (id !== null) { clearInterval(id); id = null; }
      } else {
        startClock();
      }
    }

    startClock();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (id !== null) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="statusbar" role="status" aria-label="device status">
      <div className="statusbar__left">
        <span className="statusbar__time" suppressHydrationWarning>
          {time}
        </span>
        <span className="statusbar__carrier">DEV_OS</span>
      </div>
      <div className="statusbar__right" aria-hidden>
        <span className="statusbar__signal">
          <i style={{ height: 4 }} />
          <i style={{ height: 7 }} />
          <i style={{ height: 10 }} />
          <i style={{ height: 13, opacity: 0.5 }} />
        </span>
        <span className="statusbar__cell">5G</span>
        <span className="statusbar__battery" aria-hidden>
          <span className="statusbar__battery-num">78%</span>
          <span className="statusbar__battery-box">
            <i />
          </span>
        </span>
      </div>
    </div>
  );
}
```

---

### Step 2.8 — Fix ContactForm a11y

- [ ] In `ContactForm.tsx`, apply three changes:

**1. Add `aria-busy` to the form:**
```tsx
<form onSubmit={submit} className="contact" aria-busy={status === 'submitting'}>
```

**2. Wrap submit row in `aria-live="polite"`:**
```tsx
<div className="contact__submitrow" aria-live="polite">
  <button type="submit" disabled={status === 'submitting'} className="contact__send">
    {status === 'submitting' ? 'TRANSMITTING...' : 'EXECUTE_SEND'}
  </button>
  <p className="contact__cursor">waiting for manual override... _</p>
</div>
```

**3. Add `role="status"` to the success state container:**
```tsx
if (status === 'success') {
  return (
    <div className="contact contact--success" role="status">
      <p>EXECUTE_SEND :: SUCCESS</p>
      <p>handshake initiated · expect reply within 48h</p>
    </div>
  );
}
```

---

### Step 2.9 — Fix skip-to-content focusability in `app/page.tsx`

- [ ] In `app/page.tsx`, add `tabIndex={-1}` to the `<main>` element:

```tsx
<main className="page" id="main-content" tabIndex={-1}>
```

---

### Step 2.10 — Fix skip-to-content CSS in `app/css/_base.css`

- [ ] In `app/css/_base.css`, find the `.skip-to-content` block (around line 59). Replace `top: -100%;` and its `:focus { top: 0; }` pattern with `clip-path`:

Replace:
```css
.skip-to-content {
  position: absolute;
  top: -100%;
  left: 0;
  z-index: 9999;
  padding: 8px 16px;
  background: var(--signal);
  color: #000;
  font-family: var(--font-mono-stack);
  font-size: var(--fs-md);
  font-weight: 700;
  text-decoration: none;
  transition: top 0.1s;
}
.skip-to-content:focus {
  top: 0;
}
```

With:
```css
.skip-to-content {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 9999;
  padding: 8px 16px;
  background: var(--signal);
  color: #000;
  font-family: var(--font-mono-stack);
  font-size: var(--fs-md);
  font-weight: 700;
  text-decoration: none;
  clip-path: inset(50%);
  overflow: hidden;
  transition: clip-path 0.1s;
}
.skip-to-content:focus {
  clip-path: inset(0);
  overflow: visible;
}
```

---

### Step 2.11 — Verify and commit

- [ ] Run: `pnpm ci:local`

  Expected: zero errors. Run also `pnpm test` and confirm `motion.test.ts`, `skip-to-content.test.ts`, `sysfail-loop.test.ts` all pass.

- [ ] Manual checks:
  - Enable motion via topbar toggle → Hero boot animation runs, MatrixRain renders, RoleTyper animates
  - Disable motion → all three are static
  - Tab to skip link in browser → focus jumps to `<main>` (no scroll jump, focus visible)
  - Tab through contact form with screen reader or VoiceOver → "TRANSMITTING..." is announced on submit, success state announced

- [ ] Commit:

```bash
git add components/sections/Hero.tsx components/responsive/MatrixRain.tsx \
        components/client/RoleTyper.tsx components/client/InteractiveShell.tsx \
        components/sections/Footer.tsx components/responsive/StatusBar.tsx \
        components/client/ContactForm.tsx app/page.tsx app/css/_base.css
git commit -m "feat(motion): replace matchMedia with readMotion(), add visibility pause, fix a11y"
```

---

## Task 3 — Type safety (findings #1, #3, #6, #8, #20)

**Files:**
- Modify: `components/responsive/MatrixRain.tsx`
- Modify: `components/sections/Hero.tsx`
- Modify: `components/sections/GuitarSection.tsx`
- Modify: `app/css/_sections.css`
- Modify: `biome.json`
- Create: `lib/events.ts`

---

### Step 3.1 — Remove non-null assertions in `MatrixRain.tsx`

- [ ] In `MatrixRain.tsx`, after the two null guards (lines 36–39):

```ts
const canvas = canvasRef.current;
if (!canvas) return;
const ctx = canvas.getContext('2d');
if (!ctx) return;
```

Add two binding consts immediately after:

```ts
const canvasEl = canvas;
const ctxEl = ctx;
```

- [ ] Replace every `canvas!` with `canvasEl` and every `ctx!` with `ctxEl` throughout the `useEffect` body. Affected lines (11 assertions): `resize()`, `frame()`, the `ctx!.font` line, the `ctx!.fillStyle` lines, `ctx!.fillRect`, `ctx!.setTransform`, `ctx!.fillText` × 2, and `ctx!.fillStyle` × 2 in the body.

After replacement, run `pnpm typecheck` — should produce zero `!` assertion errors from MatrixRain.

---

### Step 3.2 — Fix Hero `onFirstLoop` ref ordering

- [ ] In `DesktopHero` `useEffect`, the `onFirstLoop` callback currently reads `bootCtrl.current?.pauseDialog()` and `bootCtrl.current?.resumeDialog()`. After Task 2's changes, `ctrl` is already in scope. Replace those two calls:

Inside the `onFirstLoop` callback (the two lines in the sysfail block):

Replace:
```ts
bootCtrl.current?.pauseDialog();
```
With:
```ts
ctrl.pauseDialog();
```

Replace (in the `setTimeout` callback 300ms later):
```ts
bootCtrl.current?.resumeDialog();
```
With:
```ts
ctrl.resumeDialog();
```

`bootCtrl.current` is still needed for the React ref object (it's set after `runBoot` so the ref itself tracks the controller for any external access). The `onFirstLoop` closure now closes over `ctrl` directly, which is the value returned by `runBoot` — no stale-ref risk.

---

### Step 3.3 — Replace inline font size in `GuitarSection.tsx`

- [ ] In `GuitarSection.tsx`, the `<pre className="guitar-mobile">` element has `style={{ ..., fontSize: '11.5px', ... }}`. Remove `fontSize: '11.5px'` from the inline style and add a CSS class:

Change:
```tsx
<pre
  className="guitar-mobile"
  style={{
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    fontSize: '11.5px',
    lineHeight: 1.7,
  }}
>
```

To:
```tsx
<pre
  className="guitar-mobile guitar__spec-label"
  style={{
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    lineHeight: 1.7,
  }}
>
```

---

### Step 3.4 — Add CSS class in `app/css/_sections.css`

- [ ] In `app/css/_sections.css`, add the new class immediately after the `.guitar-mobile` block (around line 189):

```css
.guitar__spec-label {
  font-size: var(--fs-xs);
}
```

---

### Step 3.5 — Promote `useExhaustiveDependencies` in `biome.json`

- [ ] In `biome.json`, find the line (around line 40):

```json
"useExhaustiveDependencies": "warn"
```

Change to:

```json
"useExhaustiveDependencies": "error"
```

- [ ] Run `pnpm check` immediately. Fix any newly-surfaced violations before proceeding. Common patterns to fix:
  - A `useCallback` or `useEffect` with missing deps — add the missing dep or wrap stable values in `useRef`
  - A `useMemo` with a stale closure — add the dep

  If a dep is intentionally excluded (e.g. a stable ref), add a `// biome-ignore lint/correctness/useExhaustiveDependencies: <reason>` comment.

---

### Step 3.6 — Create `lib/events.ts` with typed custom event map

- [ ] Create `lib/events.ts`:

```ts
declare global {
  interface WindowEventMap {
    'module:open': CustomEvent<{ id: string }>;
    'sysfail:start': CustomEvent;
    'sysfail:end': CustomEvent;
    'shell-cmd-run': CustomEvent;
  }
}

export {};
```

The `export {}` makes this a module so the `declare global` is valid.

- [ ] Open `tsconfig.json` and verify `lib/events.ts` is picked up by the `include` glob (it should be, since `lib/**` is typically included). If not, add `"lib/events.ts"` to the `include` array.

- [ ] Now remove `as CustomEvent<...>` casts in any consumer that had them. Search:

```bash
grep -rn 'as CustomEvent' components/ app/ lib/ --include="*.ts" --include="*.tsx"
```

For each hit, the cast is no longer needed — TypeScript now infers the type from the `WindowEventMap` extension.

---

### Step 3.7 — Verify and commit

- [ ] Run: `pnpm tsc --noEmit`

  Expected: zero errors.

- [ ] Run: `pnpm check`

  Expected: zero errors (no remaining warnings promoted from `useExhaustiveDependencies`).

- [ ] Run: `pnpm test`

  Expected: `matrix-rain.test.ts` passes.

- [ ] Commit:

```bash
git add components/responsive/MatrixRain.tsx components/sections/Hero.tsx \
        components/sections/GuitarSection.tsx app/css/_sections.css \
        biome.json lib/events.ts
git commit -m "fix(types): remove non-null assertions, fix onFirstLoop ref, typed events, biome error level"
```

---

## Task 4 — API & infra (findings #12, #13, #18, #19)

**Files:**
- Modify: `lib/rate-limit.ts`
- Modify: `app/api/ask/route.ts`
- Modify: `app/api/contact/route.ts`
- Modify: `components/client/InteractiveShell.tsx`

---

### Step 4.1 — Add `getClientIp` and fix `incrementBudget` in `lib/rate-limit.ts`

- [ ] Open `lib/rate-limit.ts`. Make three targeted changes:

**Add `getClientIp` export** (add after the `getContactLimit` function):

```ts
export function getClientIp(req: import('next/server').NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
```

**Add `BUDGET_WINDOW_S` constant** (add after `MONTHLY_TOKEN_BUDGET`):

```ts
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;
```

**Replace `incrementBudget`** entirely with the atomic pipeline version:

```ts
export async function incrementBudget(inputTokens: number, outputTokens: number): Promise<void> {
  const total = inputTokens + outputTokens;
  if (total <= 0) return;
  const key = getBudgetKey();
  try {
    const pipe = getRedis().pipeline();
    pipe.incrby(key, total);
    pipe.expire(key, BUDGET_WINDOW_S, 'NX');
    await pipe.exec<[number, number]>();
  } catch (err) {
    console.error('[ask] budget increment failed', err);
  }
}
```

The function signature changes from `void` to `Promise<void>`. The callers already ignore the return value (fire-and-forget), so this is backward compatible.

---

### Step 4.2 — Deduplicate IP extraction in `app/api/ask/route.ts`

- [ ] Open `app/api/ask/route.ts`. Add `getClientIp` to the imports:

```ts
import { checkBudget, getAskLimit, getClientIp, incrementBudget } from '@/lib/rate-limit';
```

- [ ] Replace the inline IP extraction block (lines 115–118):

```ts
// Remove:
const ip =
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  req.headers.get('x-real-ip') ??
  'anon';

// Replace with:
const ip = getClientIp(req);
```

---

### Step 4.3 — Deduplicate IP extraction in `app/api/contact/route.ts`

- [ ] Open `app/api/contact/route.ts`. Add `getClientIp` to the rate-limit imports. Find and replace the same inline IP extraction pattern with:

```ts
const ip = getClientIp(req);
```

---

### Step 4.4 — Fix `InteractiveShell.tsx` stream rendering

- [ ] In `InteractiveShell.tsx`, the `streamQuestion` function (lines 144–227) calls `setHistory` on every streamed chunk. Replace the function with a version that uses an imperative span for the active line, calling `setHistory` only twice (once to remove the loading line, once to commit the final text).

Replace the entire `streamQuestion` function:

```ts
const streamQuestion = useCallback(
  async (question: string) => {
    const loadingId = nextId();
    setHistory((h) => [...h, { id: loadingId, kind: 'loading', text: '' }]);
    let streamSpan: HTMLSpanElement | null = null;

    const finalize = (finalText: string, errMsg?: string) => {
      if (streamSpan) { streamSpan.remove(); streamSpan = null; }
      const lines: Line[] = [];
      if (finalText) lines.push({ id: nextId(), kind: 'output', text: finalText });
      if (errMsg) lines.push({ id: nextId(), kind: 'error', text: `error: ${errMsg}` });
      if (!finalText && !errMsg) lines.push({ id: nextId(), kind: 'output', text: '(empty response)' });
      setHistory((h) => [...h.filter((l) => l.id !== loadingId), ...lines]);
    };

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        finalize('', data?.error ?? `HTTP ${res.status}`);
        return;
      }
      if (!res.body) {
        finalize('', 'response body unavailable');
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += dec.decode(value, { stream: true });
        const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
        const displayText = (
          sentinelIdx !== -1 ? accumulated.slice(0, sentinelIdx) : accumulated
        ).trim();
        if (!displayText) continue;

        if (!streamSpan) {
          // First real text: swap the loading line out imperatively.
          setHistory((h) => h.filter((l) => l.id !== loadingId));
          streamSpan = document.createElement('span');
          streamSpan.className = 'shell__line shell__line--output';
          feedRef.current?.appendChild(streamSpan);
        }
        streamSpan.textContent = displayText;
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }

      const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
      const finalText = (
        sentinelIdx !== -1 ? accumulated.slice(0, sentinelIdx) : accumulated
      ).trim();
      const errMsg =
        sentinelIdx !== -1
          ? accumulated.slice(sentinelIdx + STREAM_ERR_SENTINEL.length).trim() || 'upstream error'
          : undefined;
      finalize(finalText, errMsg);
    } catch (err) {
      finalize('', (err as Error).message);
    }
  },
  [nextId],
);
```

> The `feedRef` is already declared earlier in the component. This function closes over it correctly.

---

### Step 4.5 — Verify and commit

- [ ] Run: `pnpm ci:local`

  Expected: zero errors.

- [ ] Run: `pnpm test` — confirm `redis-singleton.test.ts` and `budget-cap.test.ts` pass.

- [ ] Manual test: start `pnpm dev`, open the shell, ask a question. Confirm:
  - Loading dots appear immediately
  - Text streams in smoothly without visible re-renders
  - History is preserved after the stream closes
  - Error state (e.g. disconnect mid-stream) falls back gracefully

- [ ] Commit:

```bash
git add lib/rate-limit.ts app/api/ask/route.ts app/api/contact/route.ts \
        components/client/InteractiveShell.tsx
git commit -m "fix(api): deduplicate IP extraction, atomic Redis budget, O(1) stream rendering"
```

---

## Task 5 — Minor cleanup (findings #11, #14, #15, #16, #17)

**Files:**
- Modify: `lib/use-breakpoint.tsx`
- Modify: `components/sections/ContactSection.tsx`
- Modify: `components/sections/Footer.tsx`
- Modify: `components/sections/GitLogSection.tsx`
- Modify: `middleware.ts`
- Modify: `app/layout.tsx`

---

### Step 5.1 — Migrate `use-breakpoint.tsx` to `useSyncExternalStore`

- [ ] Replace the `useState` + `useEffect` pattern in `BreakpointProvider` with `useSyncExternalStore`. Full updated file:

```tsx
'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
} from 'react';
import { MOBILE_BREAKPOINT_PX } from './breakpoint';

type BreakpointCtx = {
  isMobile: boolean;
  forceDesktop: boolean;
};

const Ctx = createContext<BreakpointCtx | null>(null);

export function BreakpointProvider({
  initialIsMobile,
  forceDesktop = false,
  children,
}: {
  initialIsMobile: boolean;
  forceDesktop?: boolean;
  children: ReactNode;
}) {
  const mqRef = useRef<MediaQueryList | null>(null);
  if (!mqRef.current && typeof window !== 'undefined') {
    mqRef.current = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
  }

  // subscribe must be stable — mqRef never changes after first mount
  const subscribe = useCallback(
    (cb: () => void) => {
      mqRef.current?.addEventListener('change', cb);
      return () => mqRef.current?.removeEventListener('change', cb);
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: mqRef is a stable useRef, never recreated
    [],
  );

  const isMobileFromMedia = useSyncExternalStore(
    subscribe,
    () => mqRef.current?.matches ?? initialIsMobile,
    () => initialIsMobile,
  );

  const isMobile = forceDesktop ? false : isMobileFromMedia;

  return <Ctx.Provider value={{ isMobile, forceDesktop }}>{children}</Ctx.Provider>;
}

export function useBreakpoint(): BreakpointCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBreakpoint must be used inside <BreakpointProvider>');
  return ctx;
}
```

---

### Step 5.2 — Add `mobileHeader` to `ContactSection.tsx`

- [ ] In `ContactSection.tsx`, add `mobileHeader` to the `<Module>` call:

```tsx
<Module id="sec-contact" header="SUDO CONTACT --INIT" mobileHeader="CONTACT" icon={<IconContact />}>
```

---

### Step 5.3 — Fix unstable React keys

**Footer DMESG** (already fixed in Task 1 Step 1.8 with `key={line.off}`). Verify the `key` on the `<li>` uses `line.off`, not index.

**GitLogSection commits** — in `GitLogSection.tsx`:

- [ ] In the `<pre>` render, replace `COMMITS.map((c, i) => renderCommit(c, i))` with `COMMITS.map((c) => renderCommit(c, c.hash))`:

```tsx
<pre>{COMMITS.map((c) => renderCommit(c, c.hash))}</pre>
```

- [ ] Update `renderCommit` signature from `(c: GitCommit, key: number)` to `(c: GitCommit, key: string)`:

```ts
function renderCommit(c: GitCommit, key: string): ReactNode {
```

The internal `key={i}` on body lines stays as-is (index is fine for stable sub-arrays that don't reorder).

**ReadmeSection** — index keys are acceptable since `README_DESKTOP` and `README_MOBILE` are static arrays that never reorder. No change needed.

---

### Step 5.4 — Add CSP comment in `middleware.ts`

- [ ] In `middleware.ts`, find the `style-src 'unsafe-inline'` line and add a one-line comment above it:

```ts
// 'unsafe-inline' required: Tailwind v4 injects styles at runtime; React inline style props cannot use nonces
"style-src 'self' 'unsafe-inline'",
```

---

### Step 5.5 — Set display font `preload: false` in `app/layout.tsx`

- [ ] In `app/layout.tsx`, find the `display` font declaration (lines 18–23):

```ts
const display = localFont({
  src: [{ path: '../public/fonts/inter-900.woff2', weight: '900', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});
```

Change `preload: true` to `preload: false`:

```ts
const display = localFont({
  src: [{ path: '../public/fonts/inter-900.woff2', weight: '900', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
  preload: false,
});
```

The font still loads on demand when `.hero__name` CSS rule is matched on desktop. Mobile overrides the font to the mono stack, so this font is never fetched on mobile.

---

### Step 5.6 — Verify and commit

- [ ] Run: `pnpm ci:local`

  Expected: zero errors.

- [ ] Manual checks:
  - Mobile viewport: resize to 375px wide, reload — no flash of wrong layout on first paint (confirms `useSyncExternalStore` SSR snapshot is correct)
  - Contact section on mobile: open dock/module header — short header "CONTACT" is visible
  - Navigate to footer — GitLog commits render correctly

- [ ] Commit:

```bash
git add lib/use-breakpoint.tsx components/sections/ContactSection.tsx \
        components/sections/GitLogSection.tsx middleware.ts app/layout.tsx
git commit -m "fix(cleanup): useSyncExternalStore breakpoint, stable keys, CSP comment, font preload"
```

---

## Execution order rationale

| # | Task | Why first |
|---|---|---|
| 1 | Content migration | Largest structural change; all other tasks touch the same files but for different reasons — isolate first |
| 2 | Motion & a11y | Most user-visible findings; no dependency on Task 1 |
| 3 | Type safety | Biome level-up may surface violations in files already changed by Task 1 and 2 — run after those are committed |
| 4 | API & infra | Server-side only, low UI risk; depends on nothing above |
| 5 | Minor cleanup | No dependencies, safe final sweep |

Each task ends with `pnpm ci:local` passing before committing. Total: 5 commits, all findings addressed.
