# CSS Token Deprecation Process

**Owner:** Design System Team
**Last Updated:** January 13, 2026
**Status:** Active

---

## Overview

This document outlines the process for deprecating CSS custom properties (design tokens) in the portfolio design system. With 400+ tokens in `libs/shared/styles/src/tokens.css`, maintaining a clean token taxonomy is critical for long-term maintainability.

## Principles

1. **Explicit over Implicit**: Mark deprecated tokens clearly in code
2. **Gradual Migration**: 60-day deprecation window before removal
3. **Automated Enforcement**: Use linter rules to prevent new usage
4. **Clear Alternatives**: Always provide replacement tokens

---

## Deprecation Process (4 Steps)

### Step 1: Mark Token as Deprecated

Add `@deprecated` comment with replacement in `tokens.css`:

```css
:root {
  /* @deprecated Use --color-matrix-green instead. Will be removed in v2.0 */
  --color-primary: var(--color-matrix-green);

  /* Current token */
  --color-matrix-green: #00ff41;
}
```

**Why keep the old token?**

- Prevents immediate breakage
- Gives teams time to migrate
- Old token forwards to new token (zero runtime cost)

---

### Step 2: Add Linter Rule

Update `eslint.config.mjs` to warn on deprecated token usage:

```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.css'],
    plugins: {
      'css-custom': cssCustomPlugin,
    },
    rules: {
      'css-custom/no-deprecated-tokens': [
        'warn',
        {
          deprecated: {
            '--color-primary': {
              replacement: '--color-matrix-green',
              reason: 'Generic name conflicts with future tokens',
              removeIn: 'v2.0',
            },
            '--spacing-old': {
              replacement: '--spacing-4',
              reason: 'Migrating to 8px grid system',
              removeIn: 'v2.0',
            },
          },
        },
      ],
    },
  },
];
```

**Enforcement levels:**

- First 30 days: `warn` (allows existing usage)
- Days 31-60: `error` (blocks new usage, existing usage must be fixed)
- After 60 days: Remove token entirely

---

### Step 3: Create Migration PR

**Template for migration PR:**

````markdown
## [MIGRATION] Deprecate --color-primary

### Summary

Deprecating `--color-primary` in favor of `--color-matrix-green` to align with design system naming conventions.

### Changes

- [ ] Mark token as deprecated in tokens.css
- [ ] Add linter rule
- [ ] Update all usages (23 files)
- [ ] Update documentation
- [ ] Set removal date (60 days from merge)

### Migration Guide

**Before:**

```css
.hero {
  color: var(--color-primary);
}
```
````

**After:**

```css
.hero {
  color: var(--color-matrix-green);
}
```

### Timeline

- **Today**: Deprecation warning added
- **Day 30**: Linter becomes `error` level
- **Day 60**: Token removed entirely

### Affected Files

- apps/shell/components/sections/hero/hero.module.css
- libs/shared/ui/src/button/button.module.css
- ... (21 more files)

### Breaking Changes

None - old token forwards to new token during migration period.

````

---

### Step 4: Remove Token (After 60 Days)

**Checklist before removal:**

1. ✅ Verify zero usages with grep:
   ```bash
   pnpm grep-search --query="--color-primary" --isRegexp=false
````

2. ✅ Verify linter catches all usages:

   ```bash
   pnpm lint
   ```

3. ✅ Remove deprecated token from `tokens.css`

4. ✅ Remove linter rule (no longer needed)

5. ✅ Update CHANGELOG with removal notice

---

## Token Naming Conventions

To prevent future deprecations, follow these naming patterns:

### Color Tokens

```css
/* ✅ Good: Semantic + context */
--color-matrix-green: #00ff41;
--color-text-primary: var(--color-matrix-green);
--color-surface-dark: #000000;

/* ❌ Bad: Generic names */
--color-primary: #00ff41;
--text-color: #00ff41;
--dark: #000000;
```

### Spacing Tokens

```css
/* ✅ Good: 8px grid system */
--spacing-1: 0.25rem; /* 4px */
--spacing-2: 0.5rem; /* 8px */
--spacing-4: 1rem; /* 16px */
--spacing-8: 2rem; /* 32px */

/* ❌ Bad: Arbitrary names */
--spacing-small: 0.5rem;
--spacing-medium: 1rem;
--spacing-big: 2rem;
```

### Typography Tokens

```css
/* ✅ Good: Functional names */
--font-size-body: 1rem;
--font-size-heading-1: 2.5rem;
--line-height-body: 1.5;

/* ❌ Bad: Generic names */
--font-size-normal: 1rem;
--font-size-big: 2.5rem;
```

---

## Automated Token Audit

Run quarterly audits to detect potential issues:

```bash
# Find duplicate values (candidates for consolidation)
pnpm analyze:tokens

# Find unused tokens (candidates for removal)
pnpm analyze:deps --include-css
```

**Expected output:**

```
Token Audit Report
------------------
✅ Total tokens: 412
⚠️  Duplicates: 8 (2% - within acceptable range)
❌ Unused: 3 (< 1% - good)
⚠️  Without fallbacks: 12 (3% - review)

Duplicate Values:
  --color-matrix-green, --color-primary-accent → #00ff41
  --spacing-4, --spacing-base → 1rem

Unused Tokens:
  --color-experimental-blue (last used: 6 months ago)
  --font-family-old (last used: 1 year ago)
```

---

## Linter Plugin Implementation

For custom CSS token linting, create a simple plugin:

```javascript
// tools/eslint-plugin-css-tokens/index.js
export default {
  rules: {
    'no-deprecated-tokens': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow usage of deprecated CSS custom properties',
        },
        messages: {
          deprecated: 'Token {{token}} is deprecated. Use {{replacement}} instead. (Removal: {{removeIn}})',
        },
      },
      create(context) {
        const deprecated = context.options[0]?.deprecated || {};

        return {
          // Check for var(--token-name) usage
          Literal(node) {
            if (typeof node.value !== 'string') return;

            const matches = node.value.matchAll(/var\((--[\w-]+)\)/g);
            for (const match of matches) {
              const token = match[1];
              if (deprecated[token]) {
                context.report({
                  node,
                  messageId: 'deprecated',
                  data: {
                    token,
                    replacement: deprecated[token].replacement,
                    removeIn: deprecated[token].removeIn,
                  },
                });
              }
            }
          },
        };
      },
    },
  },
};
```

---

## Migration Priorities

**Priority Matrix for token deprecation:**

| Token Type                   | Usage Count | Priority | Justification                  |
| ---------------------------- | ----------- | -------- | ------------------------------ |
| Generic colors (`--primary`) | 50+         | P0       | High collision risk            |
| Spacing with arbitrary names | 30+         | P1       | Migration to 8px grid          |
| Old font tokens              | 10-20       | P2       | Low impact, can wait           |
| Experimental tokens          | < 5         | P3       | Remove if unused for 6+ months |

---

## FAQs

### Q: Why not just replace tokens with find-replace?

**A:** Gradual migration prevents:

- Breaking production deployments mid-sprint
- Forcing other teams to halt work for migrations
- Creating merge conflicts across 20+ open PRs

### Q: Can we deprecate multiple tokens at once?

**A:** Yes, but batch by category (e.g., all color tokens, all spacing tokens). Avoid mixing categories to keep PRs focused.

### Q: What if a token is used in a third-party library?

**A:** Keep the deprecated token indefinitely as a "compatibility shim". Document as `@deprecated-external` to distinguish from internal deprecations.

### Q: How do we handle tokens in generated CSS (e.g., from design tools)?

**A:** Add a preprocessing step in the design tool export pipeline to transform old tokens → new tokens automatically.

---

## Checklist: Deprecating a Token

- [ ] Mark token with `@deprecated` comment in tokens.css
- [ ] Forward old token to new token (no runtime cost)
- [ ] Add linter rule with `warn` level
- [ ] Create migration PR with timeline
- [ ] Update documentation
- [ ] Set calendar reminder for Day 30 (escalate to `error`)
- [ ] Set calendar reminder for Day 60 (remove token)
- [ ] Communicate in design system channel
- [ ] Add to CHANGELOG under "Deprecations" section

---

## References

- **Token Taxonomy**: `docs/MATRIX_DESIGN_SYSTEM.md`
- **Linter Rules**: `eslint.config.mjs`
- **Token Definitions**: `libs/shared/styles/src/tokens.css`
- **Migration Template**: `.github/ISSUE_TEMPLATE/token-deprecation.md` (create if needed)

---

## Contact

Questions? Reach out to:

- **Design System Lead**: @erikunha
- **Frontend Architecture**: @erikunha
- **Slack Channel**: #design-system (or equivalent)
