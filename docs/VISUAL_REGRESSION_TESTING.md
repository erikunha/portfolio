# Visual Regression Testing Strategy

**Owner:** Quality Engineering Team
**Last Updated:** January 13, 2026
**Status:** Planning (Not Yet Integrated)

---

## Overview

This document outlines the integration plan for visual regression testing using Chromatic or Percy. Visual regression testing catches UI bugs that unit and e2e tests miss, especially CSS changes that break layouts silently.

**Note:** API integration is deferred per project requirements. This document serves as a blueprint for future implementation.

---

## Why Visual Regression Testing?

### Problems It Solves

1. **CSS Changes Break Layouts Silently**
   - Button alignment shifts → test passes, users see broken UI
   - Responsive breakpoints change → mobile users affected
   - Color contrast violations introduced → accessibility degraded

2. **Manual QA is Expensive**
   - 2-4 hours/week reviewing visual changes across browsers
   - Human error: easy to miss subtle shifts or color changes
   - Doesn't scale with component growth

3. **E2E Tests Don't Catch Visual Bugs**
   - Playwright verifies behavior, not appearance
   - Button works but looks wrong → test passes ✅, user experience fails ❌

### Benefits

- **Catch bugs in CI**: Block merges on visual regressions
- **Cross-browser coverage**: Chromatic tests 6 browsers automatically
- **Component snapshots**: Snapshot Storybook stories for isolated testing
- **Faster QA**: Automate 80% of visual review work

---

## Recommended Solution: Chromatic

**Why Chromatic over Percy?**

| Feature                   | Chromatic                                       | Percy                       |
| ------------------------- | ----------------------------------------------- | --------------------------- |
| **Storybook Integration** | Native (same company)                           | Third-party                 |
| **Browsers Tested**       | 6 (Chrome, Firefox, Safari, Edge, IE11, Mobile) | 3 (Chrome, Firefox, Safari) |
| **Pricing**               | $149/month (5K snapshots)                       | $299/month (5K snapshots)   |
| **Build Time**            | ~3 min for 50 stories                           | ~5 min for 50 stories       |
| **Diff Algorithm**        | Advanced (ignores anti-aliasing)                | Standard                    |
| **UI Review**             | Excellent (built-in component explorer)         | Good                        |

**Verdict:** Chromatic for Storybook-based projects. Percy if using Playwright only.

---

## Integration Plan (4 Phases)

### Phase 1: Setup Chromatic (Week 1)

**1.1 Install Chromatic CLI**

```bash
pnpm add -D chromatic
```

**1.2 Add Chromatic script to package.json**

```json
{
  "scripts": {
    "chromatic": "chromatic --project-token=$CHROMATIC_PROJECT_TOKEN",
    "chromatic:ci": "chromatic --exit-zero-on-changes --exit-once-uploaded"
  }
}
```

**1.3 Create Chromatic account and link project**

```bash
npx chromatic --project-token=<YOUR_TOKEN>
```

**Expected output:**

```
✔ Storybook published to: https://chromatic.com/build?appId=abc123
✔ Build passed! No visual changes detected.
```

---

### Phase 2: Snapshot Critical Components (Week 2)

**2.1 Define snapshot strategy**

**High Priority (Snapshot First):**

- [ ] HeroSection (responsive breakpoints)
- [ ] Navigation (mobile/desktop)
- [ ] Button (hover and disabled states)
- [ ] 404 page (error states)

**Medium Priority (Phase 3):**

- [ ] ProjectCard (hover states)
- [ ] AboutSection (content variations)
- [ ] ContactForm (validation states)

**Low Priority (Phase 4):**

- [ ] Footer
- [ ] LoadingSpinner
- [ ] Tooltip

**2.2 Create Storybook stories for visual testing**

```tsx
// apps/shell/components/ui/button/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    // Chromatic-specific parameters
    chromatic: {
      viewports: [375, 768, 1200], // Mobile, tablet, desktop
      delay: 300, // Wait for animations
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ✅ Snapshot default state
export const Default: Story = {
  args: {
    children: 'Click me',
    variant: 'primary',
  },
};

// ✅ Snapshot disabled state
export const Disabled: Story = {
  args: {
    children: 'Disabled button',
    disabled: true,
  },
};

// ✅ Snapshot hover state
export const Hover: Story = {
  args: Default.args,
  parameters: {
    pseudo: { hover: true },
  },
};
```

**2.3 Run initial snapshot**

```bash
pnpm chromatic
```

**Expected outcome:**

- 15-20 baseline snapshots captured
- All stories pass (no diffs on first run)

---

### Phase 3: CI Integration (Week 3)

**3.1 Add Chromatic to GitHub Actions**

```yaml
# .github/workflows/chromatic.yml
name: Chromatic

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for Chromatic

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Storybook
        run: pnpm nx build-storybook ui

      - name: Run Chromatic
        uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          exitZeroOnChanges: false # Block merge on changes
          exitOnceUploaded: false # Wait for review
          autoAcceptChanges: main # Auto-accept changes on main branch
```

**3.2 Add status check to branch protection**

```
Repository Settings → Branches → main → Require status checks
☑ chromatic
```

**Expected behavior:**

- PR opened → Chromatic runs automatically
- Visual changes detected → PR blocked until reviewed
- Reviewer approves changes in Chromatic UI → PR unblocked

---

### Phase 4: Playwright Visual Testing (Optional, Week 4)

**Note:** Chromatic handles Storybook components. For full-page snapshots, use Playwright.

**4.1 Add Playwright visual regression**

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage snapshot', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for fonts and images to load
    await page.waitForLoadState('networkidle');

    // Take full-page snapshot
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixels: 100, // Allow minor anti-aliasing differences
    });
  });

  test('navigation visual', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Snapshot desktop navigation
    await expect(page).toHaveScreenshot('navigation-desktop.png');

    // Snapshot mobile navigation
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Wait for responsive layout

    await expect(page).toHaveScreenshot('navigation-mobile.png');
  });
});
```

**4.2 Run baseline snapshot**

```bash
pnpm playwright test visual-regression.spec.ts --update-snapshots
```

**Expected outcome:**

- Baseline PNG files generated in `e2e/visual-regression.spec.ts-snapshots/`
- Future test runs compare against these baselines

---

## Cost Analysis

### Chromatic Pricing

**Free Tier:**

- 5,000 snapshots/month
- Unlimited team members
- 30-day history

**Starter Plan ($149/month):**

- 15,000 snapshots/month
- Unlimited team members
- 90-day history
- Priority support

**Estimated Usage:**

- 50 Storybook stories × 3 viewports × 6 browsers = 900 snapshots/build
- 5 builds/day (PR + merge) = 4,500 snapshots/day
- Monthly: 4,500 × 20 workdays = 90,000 snapshots ⚠️

**Optimization strategies:**

1. **Limit browsers**: Test only Chrome + Safari (reduce to 300 snapshots/build)
2. **Limit viewports**: Test only mobile + desktop (reduce to 200 snapshots/build)
3. **Use turbosnap**: Only snapshot changed components (reduce by 80%)

**Optimized usage:**

- 200 snapshots/build × 5 builds/day × 20 days = 20,000 snapshots/month
- **Cost:** $149/month (Starter plan)

---

## ROI Calculation

**Current state (manual QA):**

- 4 hours/week × $75/hour = $300/week
- $1,200/month in QA time

**With Chromatic:**

- $149/month subscription
- 30 minutes/week reviewing Chromatic diffs = $150/month
- **Total: $299/month**

**Savings:**

- $1,200 - $299 = **$901/month saved**
- **Payback period:** Immediate (first month)

**Additional benefits:**

- Faster PR reviews (automated visual checks)
- Catch bugs before production (reduces hotfix burden)
- Cross-browser coverage (catches Safari-specific bugs)

---

## Rollout Checklist

### Pre-Launch

- [ ] Create Chromatic account
- [ ] Add Storybook stories for 15 critical components
- [ ] Run baseline snapshot
- [ ] Configure CI workflow
- [ ] Add branch protection rule
- [ ] Train team on Chromatic UI review

### Launch (Day 1)

- [ ] Enable Chromatic checks on all PRs
- [ ] Monitor false positive rate
- [ ] Adjust diff thresholds if needed

### Post-Launch (Week 1-2)

- [ ] Review first 10 PRs with visual changes
- [ ] Collect team feedback
- [ ] Adjust snapshot strategy based on findings
- [ ] Document common review patterns

### Ongoing

- [ ] Quarterly review of snapshot coverage
- [ ] Archive unused snapshots
- [ ] Monitor snapshot quota usage
- [ ] Refine turbosnap configuration

---

## Common Pitfalls & Mitigations

### Pitfall 1: Flaky Snapshots (fonts not loaded)

**Symptom:** Snapshots fail randomly with "font not loaded" diffs

**Fix:**

```typescript
// .storybook/preview.ts
export const parameters = {
  chromatic: {
    delay: 500, // Wait for fonts
  },
};
```

### Pitfall 2: Anti-Aliasing Differences

**Symptom:** 1-pixel diffs on text rendering across browsers

**Fix:**

```typescript
await expect(page).toHaveScreenshot('test.png', {
  maxDiffPixelRatio: 0.01, // Allow 1% pixel difference
});
```

### Pitfall 3: Animation Flakiness

**Symptom:** Snapshots differ based on animation timing

**Fix:**

```css
/* .storybook/preview-head.html */
<style>
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
</style>
```

### Pitfall 4: Snapshot Quota Exhaustion

**Symptom:** Chromatic fails mid-month due to quota exceeded

**Fix:**

```yaml
# Use turbosnap to only test changed stories
chromatic:
  onlyChanged: true
```

---

## Alternatives Considered

### Percy (Rejected)

**Pros:**

- Works with Playwright tests directly
- Good UI for reviewing diffs

**Cons:**

- 2x cost vs Chromatic ($299 vs $149)
- Only 3 browsers (vs 6)
- No native Storybook integration

### Playwright Screenshots (Rejected)

**Pros:**

- Free (built into Playwright)
- No third-party dependency

**Cons:**

- No cross-browser testing (only Chromium in CI)
- Manual diff review (no UI)
- No component-level isolation (full-page only)
- High maintenance (managing PNGs in Git)

---

## Next Steps (When Ready to Integrate)

1. **Stakeholder approval**: Get budget approval for $149/month
2. **Create Chromatic account**: Sign up at https://chromatic.com
3. **Assign owner**: Designate team member for snapshot review
4. **Pilot with 5 components**: Start small, validate workflow
5. **Expand coverage**: Add remaining components over 4 weeks
6. **Enable CI blocking**: Require Chromatic checks after pilot success

---

## References

- **Chromatic Docs**: https://www.chromatic.com/docs
- **Percy Docs**: https://docs.percy.io
- **Playwright Visual Comparisons**: https://playwright.dev/docs/test-snapshots
- **Storybook Test Runner**: https://storybook.js.org/docs/react/writing-tests/test-runner

---

## Contact

Questions? Reach out to:

- **QA Lead**: @erikunha
- **Frontend Architecture**: @erikunha
- **Budget Approval**: @erikunha (or project stakeholder)
