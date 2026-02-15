# ADR-016: Flat-First Shared UI Library Organization

**Status**: Accepted
**Date**: 2026-01-13
**Deciders**: Erik Henrique Alves Cunha
**Technical Story**: Migration from atomic design to flat structure for shared UI library

---

## Context and Problem Statement

ADR-015 introduced purpose-based component organization for app-specific components (`apps/shell/components/`) but mentioned "existing components reorganized into atomic structure" for the shared UI library. This created confusion about whether atomic design (`atoms/`, `molecules/`, `organisms/`) was the target architecture or a transitional state.

The shared UI library (`libs/shared/ui`) currently has only 1 component (Button), making any hierarchical organization premature. We need to clarify:

1. Is atomic design the permanent structure for shared UI?
2. When should we introduce grouping/hierarchy?
3. How do we ensure consumer import paths remain stable during reorganization?

---

## Decision Drivers

- **Simplicity**: Avoid unnecessary hierarchy for small libraries (< 10 components)
- **Discoverability**: Developers should find components quickly
- **Stability**: Consumer imports must not break during internal reorganization
- **Industry Standards**: Netflix, Airbnb, and GitHub use functional grouping, not atomic design at scale
- **Future-Proofing**: Structure must accommodate growth from 1 to 50+ components
- **Developer Experience**: Clear rules for when/how to reorganize

---

## Considered Options

### Option 1: Atomic Design (Current State)

**Structure**:

```
libs/shared/ui/src/lib/
├── atoms/
│   └── button/
├── molecules/
└── organisms/
```

**Pros**:

- Industry-recognized methodology
- Clear categories based on complexity

**Cons**:

- ❌ Adds 2-3 levels of nesting for small libraries
- ❌ Subjective categorization ("Is this an atom or molecule?")
- ❌ Overhead for single component (1 component in nested folders)
- ❌ Not mentioned in ADR-015's purpose-based philosophy
- ❌ Industry leaders (Netflix, Airbnb) moved away from atomic design

### Option 2: Flat Structure Until Growth (Selected)

**Structure** (1-7 components):

```
libs/shared/ui/src/lib/
├── button/
├── card/
└── input/
```

**Structure** (8+ components with natural groupings):

```
libs/shared/ui/src/lib/
├── forms/
│   ├── button/
│   ├── input/
│   └── select/
└── feedback/
    ├── alert/
    └── toast/
```

**Pros**:

- ✅ Zero overhead for small libraries
- ✅ Easy navigation (fewer clicks to component)
- ✅ Aligns with ADR-015's purpose-based philosophy
- ✅ Grouping introduced only when needed (8+ components)
- ✅ Consumer imports stay stable (barrel exports abstract structure)

**Cons**:

- ⚠️ Requires future reorganization (mitigated by barrel exports)

### Option 3: Immediate Purpose-Based Grouping

**Structure**:

```
libs/shared/ui/src/lib/
└── forms/
    └── button/
```

**Pros**:

- Avoids future reorganization

**Cons**:

- ❌ Premature grouping with 1 component
- ❌ Developer has to navigate extra folder for single item
- ❌ Category definitions unclear with minimal components

---

## Decision Outcome

**Chosen Option**: **Option 2 - Flat Structure Until Growth**

### Implementation Strategy

#### Phase 1: Flat Structure (Current - 7 components)

```
libs/shared/ui/src/lib/
├── button/
├── card/
├── input/
└── ...
```

**Rules**:

- All components at top level of `lib/`
- Each component in its own folder with full file set (tsx, css, spec, stories)
- Export from root barrel: `export * from './lib/button'`
- Consumer imports: `import { Button } from '@erikunha-portifolio/ui'`

#### Phase 2: Purpose-Based Grouping (8+ components)

**Triggers** (ANY of these):

- **Component count**: 8+ components in library
- **Natural groupings**: 3+ components serving similar purpose (e.g., 3+ form inputs)
- **Maintenance burden**: Flat structure becoming hard to navigate

**Migration**:

```
libs/shared/ui/src/lib/
├── forms/
│   ├── index.ts                 # export * from './button/button'
│   ├── button/
│   ├── input/
│   └── select/
└── feedback/
    ├── index.ts                 # export * from './alert/alert'
    ├── alert/
    └── toast/
```

**Category Barrels** (`lib/forms/index.ts`):

```typescript
export * from './button/button';
export * from './input/input';
export * from './select/select';
```

**Root Barrel** (`src/index.ts`):

```typescript
// Re-export from category barrels
export * from './lib/forms';
export * from './lib/feedback';
```

**Consumer Impact**: ZERO - imports remain `from '@erikunha-portifolio/ui'`

#### Pre-Approved Categories

When grouping becomes necessary, use these functional categories:

| Category        | Purpose                                  | Examples                           |
| --------------- | ---------------------------------------- | ---------------------------------- |
| `forms/`        | Input elements, form controls            | button, input, select, checkbox    |
| `feedback/`     | User notifications, status indicators    | alert, toast, banner, spinner      |
| `layout/`       | Structural components, spacing utilities | container, grid, stack, spacer     |
| `overlays/`     | Modal dialogs, popovers, tooltips        | modal, dialog, popover, tooltip    |
| `data-display/` | Content presentation, data visualization | table, card, badge, avatar         |
| `navigation/`   | Navigation controls, pagination          | tabs, breadcrumb, pagination, menu |

---

## Consequences

### Positive

✅ **Simplicity**: No hierarchy overhead for small library (current: 1 component)
✅ **Discoverability**: Faster navigation in flat structure
✅ **Alignment**: Matches ADR-015's purpose-based philosophy
✅ **Stability**: Consumer imports never break (barrel exports abstract structure)
✅ **Industry Standards**: Follows Netflix/Airbnb pattern (functional grouping when needed)
✅ **Clear Migration Path**: Explicit thresholds for when to group (8+ components)

### Negative

⚠️ **Future Migration**: Will require reorganization once library grows (MITIGATED by barrel exports)

### Neutral

📌 **Storybook Titles**: Will mirror structure (`'Components/Button'` → `'Forms/Button'` when grouped)
📌 **Documentation**: STRUCTURE.md updated with growth strategy and examples

---

## Implementation Details

### Import Stability Guarantee

**Contract**: Consumer code NEVER references internal structure.

```typescript
// ✅ ALWAYS CORRECT - Package root import
import { Button, Input, Alert } from '@erikunha-portifolio/ui';

// ❌ NEVER DO THIS - Deep imports expose internal structure
import { Button } from '@erikunha-portifolio/ui/forms/button';
import { Button } from '@erikunha-portifolio/ui/button';
```

**Enforcement**:

- ESLint rule preventing deep imports: `@erikunha-portifolio/ui/*`
- CI validation ensuring all components exported from root barrel
- Documentation explicitly prohibits deep imports

### Migration Checklist (When Grouping Needed)

1. **Create category folders** and move components
2. **Add category barrel** exports (`lib/forms/index.ts`)
3. **Update root barrel** to re-export from categories
4. **Update Storybook titles** to mirror structure (`'Forms/Button'`)
5. **Run tests**: `pnpm test` (Jest with coverage)
6. **Verify imports**: Consumer code should require ZERO changes
7. **Update documentation**: STRUCTURE.md with new organization

### Storybook Title Convention

**Current** (Flat):

```typescript
// button.stories.tsx
export default {
  title: 'Components/Button',
  component: Button,
};
```

**Future** (Grouped):

```typescript
// forms/button/button.stories.tsx
export default {
  title: 'Forms/Button',
  component: Button,
};
```

**Rule**: Story titles MUST mirror directory structure for consistency.

---

## Validation Metrics

### Success Criteria

- ✅ Consumer import paths unchanged after migration
- ✅ All tests pass after reorganization
- ✅ Storybook builds successfully
- ✅ No TypeScript errors
- ✅ ESLint passes (no deep imports)

### Performance Targets

- Bundle size impact: < 1% increase (barrel export overhead)
- Tree-shaking: 100% effective (unused components not bundled)
- Build time: < 10% increase (category barrel parsing)

---

## Future Considerations

### If Library Reaches 50+ Components

**Optimization**: Two-tier barrel system already prevents performance issues.

**Monitoring**: Add build size checks in CI to catch barrel export overhead.

### If External Consumers Emerge

**Versioning**: Consider semantic-release for `@erikunha-portifolio/ui` independently.

**Breaking Changes**: Maintain import stability via deprecation warnings + 6-month migration window.

---

## References

### Related ADRs

- ADR-015: Purpose-Based Component Organization (app-specific)
- ADR-002: Zero Runtime Styling (CSS Modules)
- ADR-008: Storybook for Visual Component Testing

### Documentation

- [STRUCTURE.md](../STRUCTURE.md) - Component organization guidelines
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) - AI-optimized development rules

### Industry Examples

- **Netflix**: Functional grouping (`forms/`, `feedback/`) for 200+ component library
- **Airbnb**: Abandoned atomic design in favor of purpose-based categories
- **GitHub Primer**: Uses flat structure for small libraries, groups by purpose at scale

---

**Last Updated**: 2026-01-13
