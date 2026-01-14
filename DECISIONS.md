# Architectural Decision Records (ADR)

This document logs all significant architectural decisions made for this platform.

Format: [ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record)

---

## ADR-001: Adopt Nx Monorepo with pnpm

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
We need a monorepo strategy that scales across multiple teams, supports deterministic builds, and integrates well with Next.js and Storybook.

**Decision**:
Adopt **Nx Monorepo (Integrated Mode)** with **pnpm** as the package manager.

**Rationale**:

- Nx provides deterministic task execution and dependency graph management
- Native support for Next.js, Storybook, and Playwright
- pnpm is faster and more disk-efficient than npm/yarn
- Nx caching significantly reduces CI times

**Consequences**:

- Positive: Faster builds, better dependency management, improved developer experience
- Negative: Learning curve for engineers unfamiliar with Nx
- Mitigation: Comprehensive onboarding documentation

---

## ADR-002: Zero Runtime Styling (CSS Modules Only)

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
Styling strategy must prioritize performance, auditability, and long-term maintainability over developer convenience.

**Decision**:
Forbid all runtime CSS-in-JS libraries (Tailwind, Styled Components, Emotion). Use **CSS Modules** with **CSS Variables** for design tokens.

**Rationale**:

- Runtime CSS-in-JS adds JavaScript bundle bloat
- Difficult to audit and debug generated styles
- CSS Modules provide compile-time scoping with zero runtime cost
- CSS Variables enable theming without JavaScript

**Consequences**:

- Positive: Predictable performance, smaller bundles, easier debugging
- Negative: Developers accustomed to Tailwind may resist
- Mitigation: Provide extensive design token library and component examples

---

## ADR-003: React Server Components as Default

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
Next.js 13+ supports React Server Components (RSC), which render on the server and reduce client-side JavaScript.

**Decision**:
All components are Server Components by default. `'use client'` is an exception that must be justified.

**Rationale**:

- Reduces client-side JavaScript bundle size
- Improves initial page load performance
- Enables direct database access from components (where appropriate)
- Better SEO and Core Web Vitals

**Consequences**:

- Positive: Faster page loads, smaller bundles, better performance
- Negative: Requires mindset shift from traditional React development
- Mitigation: Training and code review enforcement

---

## ADR-004: Module Federation for Microfrontends

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
We need a microfrontend architecture that allows independent deployment while maintaining shared dependencies.

**Decision**:
Use **Module Federation** with shell as host and microfrontends as remotes.

**Rationale**:

- Runtime composition without build-time coupling
- Independent deployment of microfrontends
- Shared dependencies (React, React-DOM) via singletons
- Well-supported by Webpack and Next.js

**Consequences**:

- Positive: Team autonomy, independent deployments, scalability
- Negative: Increased complexity in configuration
- Mitigation: Clear contracts and documentation

---

## ADR-005: TypeScript Strict Mode

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
TypeScript provides optional strictness. Looser settings allow faster iteration but introduce runtime errors.

**Decision**:
Enable **TypeScript strict mode** with additional checks:

- `strict: true`
- `noImplicitAny: true`
- `noUnusedLocals: true`
- `noImplicitReturns: true`
- `noUncheckedIndexedAccess: true`

**Rationale**:

- Catches errors at compile time, not runtime
- Improves code quality and maintainability
- Reduces debugging time
- Industry best practice for enterprise applications

**Consequences**:

- Positive: Fewer runtime errors, better developer experience
- Negative: Slightly slower initial development
- Mitigation: TypeScript training and linting

---

## ADR-006: Husky + Commitlint for Commit Enforcement

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
We need to enforce code quality standards and conventional commits before code reaches the repository.

**Decision**:
Use **Husky** for git hooks with:

- Pre-commit: Lint affected, test affected, format check
- Commit-msg: Enforce Conventional Commits via Commitlint

**Rationale**:

- Blocks broken code from being committed
- Ensures consistent commit messages for automated versioning
- Reduces CI failures

**Consequences**:

- Positive: Higher code quality, fewer CI failures
- Negative: Longer commit times (offset by affected-only checks)
- Mitigation: Fast tests and incremental linting

---

## ADR-007: Semantic Release for Automated Versioning

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
Manual versioning is error-prone and time-consuming. We need automated, deterministic version management.

**Decision**:
Use **Semantic Release** with Conventional Commits to automate:

- Version bumping
- Changelog generation
- Git tagging
- Package publishing

**Rationale**:

- Removes human error from versioning
- Enforces Semantic Versioning
- Generates changelogs automatically
- Industry standard for modern CI/CD

**Consequences**:

- Positive: Predictable releases, less manual work
- Negative: Requires strict commit message discipline
- Mitigation: Commitlint enforcement via git hooks

---

## ADR-008: Storybook for Visual Component Testing

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
UI components need isolated development, testing, and documentation.

**Decision**:
Use **Storybook** for all shared UI library components. All components must have stories documenting variants and states.

**Rationale**:

- Isolated component development
- Visual regression testing
- Living documentation
- Faster UI iteration

**Consequences**:

- Positive: Better component quality, faster development
- Negative: Additional maintenance overhead
- Mitigation: Mandatory stories enforced in code review

---

## ADR-009: Jest + Playwright for Testing

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
We need a comprehensive testing strategy covering unit, integration, and end-to-end tests.

**Decision**:

- **Jest** for unit and integration tests
- **Playwright** for end-to-end tests
- Coverage targets: 80% unit, 70% integration

**Rationale**:

- Jest is fast and well-integrated with Nx
- Playwright supports modern web features and is faster than Selenium
- Coverage targets ensure sufficient testing without diminishing returns

**Consequences**:

- Positive: High confidence in code changes
- Negative: Test maintenance overhead
- Mitigation: Focus E2E tests on critical paths only

---

## ADR-010: Feature Flags Evaluated on Server

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
Feature flags enable gradual rollouts, but client-side evaluation can leak unreleased features.

**Decision**:
All feature flags are evaluated on the server (in Server Components or middleware). UI never decides rollout.

**Rationale**:

- Prevents leaking unreleased features in client bundles
- Enables server-side A/B testing
- Reduces client-side JavaScript

**Consequences**:

- Positive: Security, performance, control
- Negative: Requires server-side flag provider integration
- Mitigation: Use LaunchDarkly, Unleash, or similar

---

## ADR-011: No Global State Without Justification

**Date**: 2026-01-09

**Status**: Accepted

**Context**:
Global state management (Redux, Zustand, etc.) adds complexity and can be overused.

**Decision**:

- Server State handled by Server Components
- Client State limited to UI concerns (`useState`, `useReducer`)
- Global state requires explicit ADR justification

**Rationale**:

- Most state doesn't need to be global
- Server Components eliminate need for client-side data fetching
- Reduces complexity and bundle size

**Consequences**:

- Positive: Simpler codebase, better performance
- Negative: Requires careful state architecture
- Mitigation: Code review enforcement

---

## ADR-012: Jest Configuration and Accessibility Testing

**Date**: 2026-01-10

**Status**: Accepted

**Context**:
Test infrastructure needed proper configuration for Jest 30+, integration with jest-axe for accessibility testing, and proper type declarations. Initial setup had compatibility issues with @jest/globals imports and missing type definitions.

**Decision**:
Standardize on Jest runtime globals (no @jest/globals imports), add jest-axe 9.0.0 for accessibility testing, and create custom type declarations for proper TypeScript support.

**Rationale**:

- Jest provides globals at runtime, explicit imports cause type conflicts
- jest-axe is industry standard for automated accessibility testing (WCAG compliance)
- Custom type declarations provide better IDE support and type safety
- Simplified test setup reduces boilerplate and improves developer experience

**Configuration**:

- All test files use Jest runtime globals (describe, it, expect, etc.)
- jest-axe integrated with custom type declarations in `jest-axe.d.ts`
- Global test setup in `jest.setup.ts` with proper mocks for window APIs
- Test configuration per library (shell, ui, styles, domain)

**Consequences**:

- Positive: Cleaner test code, better type safety, automated accessibility checks
- Negative: Requires custom type declarations for some libraries
- Mitigation: Comprehensive documentation and type declaration files

**Test Coverage**:

- Shell: 177 tests passing
- Domain: 1 test passing
- UI library: Tests configured with Storybook integration
- Styles library: 38 tests passing with full token validation

---

## ADR-013: Storybook Addon Minimalism

**Date**: 2026-01-10

**Status**: Accepted

**Context**:
Storybook 10.1.11 was experiencing compatibility issues with multiple addons. Some addons were outdated or unnecessary for our use case.

**Decision**:
Use only `@storybook/addon-a11y@10.1.11` addon. Remove all other incompatible addons (essentials, interactions, links, etc.).

**Rationale**:

- Accessibility testing is critical for WCAG compliance (ADR-009)
- Fewer addons = smaller bundle, faster build times, fewer compatibility issues
- Core Storybook functionality sufficient for component documentation
- Addon-a11y provides axe-core integration directly in Storybook UI

**Consequences**:

- Positive: Stable Storybook builds, focused on accessibility, faster startup
- Negative: Fewer built-in tools (interactions, controls testing)
- Mitigation: Use jest-axe for automated testing, manual testing for interactions

---

## ADR-014: next-seo Version Pinning

**Date**: 2026-01-10

**Status**: Accepted

**Context**:
next-seo v7 changed exports structure, breaking compatibility with existing code. The `NextSeo` named export was removed in v7.

**Decision**:
Pin `next-seo` to version `^6.8.0` until codebase can be migrated to new API.

**Rationale**:

- v6.8.0 provides all needed SEO functionality
- Maintains existing API contract without breaking changes
- Allows gradual migration planning
- Next.js Metadata API provides alternative for future

**Consequences**:

- Positive: Stable SEO functionality, no breaking changes
- Negative: Missing latest features from v7+
- Mitigation: Plan migration to Next.js native Metadata API long-term

---

## ADR-015: Purpose-Based Component Organization

**Date**: 2026-01-10

**Status**: Accepted

**Context**:
As the component library grows, we need a consistent organizational structure that scales. Components organized by technical complexity become difficult to navigate and maintain.

**Decision**:
Adopt **Purpose-Based Organization** for component structure:

- **layout/**: Page structure and navigation (skip-links, header, footer)
- **sections/**: Page content blocks (hero, about, projects, contact)
- **ui/**: Interactive controls (buttons, forms)
- **seo/**: Metadata and structured data
- **providers/**: Context providers and analytics
- **lib/infrastructure/**: System utilities (BFCache, Service Workers)

**Directory Structure**:

```
apps/shell/components/
  layout/         # Structure & navigation
  sections/       # Page content blocks
  ui/             # Interactive controls
  seo/            # Metadata & structured data
  providers/      # Context & analytics

libs/shared/ui/src/lib/
  button/         # Generic components (flat structure)
  card/           # Only truly reusable components
```

**Rationale**:

- **Clarity**: Component location indicates purpose immediately
- **Discoverability**: "Where's the language switcher?" → `ui/`
- **Stability**: Purpose changes less frequently than complexity
- **No Subjectivity**: Clear decision matrix for placement
- **Maintainability**: Refactoring doesn't require moving between categories
- **Onboarding**: New developers understand organization immediately

**Component Placement Guidelines**:

- **layout/**: Provides page structure or accessibility scaffolding
- **sections/**: Represents complete page section (full-width content)
- **ui/**: Provides user interaction (clicks, toggles, input)
- **seo/**: Generates SEO/metadata output
- **providers/**: Wraps children with context or handles analytics
- **lib/infrastructure/**: System utility without UI

**Consequences**:

- Positive: Intuitive organization, easier maintenance, stable structure
- Negative: None identified
- Documentation: Comprehensive guidelines in [docs/STRUCTURE.md](docs/STRUCTURE.md)

**Migration**:

- Existing components reorganized from previous structure
- Initial migration used atomic design as intermediate step
- See ADR-016 for final shared UI library structure (flat-first)
- Import paths updated across codebase
- All tests and stories updated with new paths
- Documentation references updated

---

## ADR-016: Flat-First Shared UI Library Organization

**Date**: 2026-01-13

**Status**: Accepted

**Context**:
ADR-015 mentioned "atomic structure" for shared UI library, creating confusion about whether this was permanent or transitional. With only 1 component (Button), any hierarchical organization is premature overhead.

**Decision**:
Adopt **flat structure** for shared UI library until reaching **8+ components**. When grouping becomes necessary, use purpose-based categories (forms/, feedback/, layout/) NOT atomic design.

```
# Current (1-7 components)
libs/shared/ui/src/lib/
├── button/
├── card/
└── input/

# Future (8+ components)
libs/shared/ui/src/lib/
├── forms/
│   ├── button/
│   └── input/
└── feedback/
    └── alert/
```

**Rationale**:

- Flat structure has zero overhead for small libraries
- Industry leaders (Netflix, Airbnb) use functional grouping, not atomic design
- Barrel exports shield consumers from internal reorganization
- Clear threshold (8+ components) triggers grouping
- Aligns with ADR-015's purpose-based philosophy

**Import Stability Guarantee**:

```typescript
// ✅ ALWAYS - Package root import
import { Button } from '@erikunha-portifolio/ui';

// ❌ NEVER - Deep imports
import { Button } from '@erikunha-portifolio/ui/forms/button';
```

**Consequences**:

- Positive: Simple navigation, faster development, stable imports
- Negative: Future reorganization needed (mitigated by barrel exports)
- Documentation: STRUCTURE.md updated with growth strategy

**Related**: ADR-015 (Purpose-Based Organization), ADR-008 (Storybook)

---

## Template for New ADRs

```markdown
## ADR-XXX: [Title]

**Date**: YYYY-MM-DD

**Status**: [Proposed | Accepted | Deprecated | Superseded]

**Context**:
[Describe the problem or situation that requires a decision]

**Decision**:
[State the decision clearly]

**Rationale**:
[Explain why this decision was made]

**Consequences**:

- Positive: [List positive outcomes]
- Negative: [List negative outcomes]
- Mitigation: [How negatives are addressed]
```

---

## Questions?

For new ADRs, open a PR adding to this document. All ADRs require team review.
