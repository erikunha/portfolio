# CSS Guidelines

## Philosophy

**Zero runtime styling. Build-time CSS only.**

This platform forbids runtime CSS-in-JS libraries (Tailwind, Styled Components, Emotion, etc.) to ensure:

- Predictable performance
- No JavaScript bundle bloat from styling
- Auditability (all CSS in `.css` files)
- Long-term maintainability

---

## Styling System

### 1. Design Tokens (CSS Variables)

All visual design decisions are centralized in:

```
libs/shared/styles/src/tokens.css
```

**Never hardcode values in components.**

#### Example: Colors

```css
/* ❌ BAD */
.button {
  background-color: #0070f3;
}

/* ✅ GOOD */
.button {
  background-color: var(--color-brand-primary);
}
```

#### Available Token Categories

- **Colors**: `--color-brand-primary`, `--color-text-primary`, `--color-background`
- **Spacing**: `--space-4`, `--space-8` (8pt grid system)
- **Typography**: `--font-size-base`, `--font-weight-semibold`
- **Radius**: `--radius-md`, `--radius-full`
- **Shadows**: `--shadow-sm`, `--shadow-lg`
- **Motion**: `--duration-fast`, `--easing-ease-out`

---

### 2. CSS Modules

All component styles use **CSS Modules** for scoping:

```tsx
// Button.tsx
import styles from './button.module.css';

export function Button() {
  return <button className={styles.primary}>Click Me</button>;
}
```

```css
/* button.module.css */
.primary {
  background-color: var(--color-brand-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
}
```

---

### 3. Global Styles

Global styles (resets, typography, utilities) are in:

```
libs/shared/styles/src/global.css
```

Imported once in the root layout:

```tsx
// app/layout.tsx
import '@erikunha-portifolio/styles/global.css';
```

---

## Rules

### ✅ ALLOWED

- CSS Modules (`.module.css`)
- CSS Variables (`--token-name`)
- Media queries
- Pseudo-classes (`:hover`, `:focus-visible`)
- CSS animations (via `@keyframes`)

### ❌ FORBIDDEN

- Inline styles (except for dynamic values like transforms)
- Tailwind utility classes
- Styled Components, Emotion, or any runtime CSS-in-JS
- External CSS libraries (Bootstrap, Material UI)
- Hardcoded values (colors, spacing, etc.)

---

## File Organization

### Component Structure

```
button/
  button.tsx              # Component logic
  button.module.css       # Scoped styles
  button.stories.tsx      # Storybook stories
```

---

## Accessibility

All interactive elements must:

1. Have visible focus states:

```css
.button:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

2. Support keyboard navigation
3. Have sufficient color contrast (WCAG AA minimum)

---

## Performance

### Constraints

- **No runtime CSS generation**
- **No JS required for styling**
- **CSS files must be < 50KB per route** (gzipped)

### Enforcement

Bundle analysis runs on every PR. Violations block merges.

---

## Common Patterns

### Responsive Design

Use media queries:

```css
.container {
  padding: var(--space-4);
}

@media (min-width: 768px) {
  .container {
    padding: var(--space-8);
  }
}
```

### Conditional Classes

Compose classes in TypeScript:

```tsx
const buttonClasses = [styles.button, variant === 'primary' ? styles.primary : styles.secondary, isFullWidth ? styles.fullWidth : ''].filter(Boolean).join(' ');

return <button className={buttonClasses}>Click</button>;
```

### Animations

Define in CSS, trigger via class:

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fadeIn {
  animation: fadeIn var(--duration-base) var(--easing-ease-out);
}
```

---

## Linting

CSS is linted via Stylelint (coming soon). Rules:

- No duplicate selectors
- No unknown properties
- No vendor prefixes (autoprefixer handles this)

---

## Migration from Runtime CSS

If migrating from Tailwind/styled-components:

1. Extract hardcoded values to design tokens
2. Convert utility classes to semantic class names
3. Move styles to CSS Modules
4. Remove runtime library imports

---

## Questions?

Refer to:

- Design tokens: `libs/shared/styles/src/tokens.css`
- Global styles: `libs/shared/styles/src/global.css`
- Example component: `libs/shared/ui/src/lib/button/`

---

**Remember: CSS is not the enemy. Runtime CSS-in-JS is.**
