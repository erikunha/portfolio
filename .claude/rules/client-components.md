---
paths:
  - "components/**"
  - "design-system/**"
  - "app/css/**"
  - "**/*.client.tsx"
---

# Components, design system and CSS

Path-scoped: loads only when working on these files. The gates are `check-client-naming`,
`lint:css-tokens`, `lint:contrast`, the component-docs coverage check and the axe gate.

## Before implementing a component

1. Which attributes does the consumer control (`id`, `className`, `aria-*`)? Pass them through,
   never override them.
2. Any `outline: none` on `:focus` must be `:focus-visible`.
3. `querySelector` returns `null`, not `undefined`: assert with `.not.toBeNull()`.
4. Can the component render twice? A hardcoded `id` breaks the second instance.

## CSS

- Tokens are `@theme` custom properties in `app/css/theme.css`; no raw hex in components.
- Complex patterns are named classes in `@layer components`, in the `app/css/components-*.css`
  partials. No CSS modules.
- Tailwind v4 ignores a utility whose token does not exist and says nothing, so check that the
  class resolves in the rendered page.
- A new interactive element needs a keyboard path, a visible focus state and a 44px target.
