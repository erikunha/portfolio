# Matrix Design System

A cyberpunk-inspired design system based on The Matrix movie aesthetic, featuring the iconic Matrix green (#1aff1a), pure black, and white.

## Color Palette

### Primary Colors

- **Matrix Green**: `#1aff1a` - The iconic Matrix code color
- **Pure Black**: `#000000` - Deep void background
- **Pure White**: `#ffffff` - High contrast text

### Theme Philosophy

The design system embraces a dark aesthetic, mirroring the Matrix's digital rain:

- **Matrix Dark Theme**: Black background with Matrix green text and accents

## Design Tokens

### Brand Colors

```css
--color-brand-primary: #1aff1a; /* Matrix Green */
--color-brand-primary-hover: #15dd15; /* Slightly darker on hover */
--color-brand-primary-active: #10bb10; /* Active state */
--color-brand-primary-dim: #0d990d; /* Dimmed variant */
```

### Neutral Scale

A gradient from pure black to pure white with Matrix green tints:

```css
--color-neutral-0: #ffffff; /* Pure white */
--color-neutral-500: #1aff1a; /* Matrix green midpoint */
--color-neutral-1000: #000000; /* Pure black */
```

### Semantic Colors

- **Success**: Matrix Green (#1aff1a) - Represents successful operations
- **Warning**: Yellow-tinted (#ffff1a) - Caution states
- **Error**: Red-tinted (#ff1a1a) - Danger/error states
- **Info**: Cyan-tinted (#1affff) - Informational messages

## Typography

### Font Family

- **Primary**: Monospace fonts (SF Mono, Monaco, Cascadia Code, Courier New)
  - Evokes the hacker/terminal aesthetic of The Matrix
  - All buttons use uppercase letters with wide letter spacing

### Font Sizes

Standard fluid scale from 12px to 48px:

- `--font-size-xs`: 0.75rem (12px)
- `--font-size-base`: 1rem (16px)
- `--font-size-5xl`: 3rem (48px)

## Visual Effects

### Glow Effects

Matrix-inspired glow using green box-shadows:

```css
--shadow-glow: 0 0 10px rgba(26, 255, 26, 0.8), 0 0 20px rgba(26, 255, 26, 0.6), 0 0 30px rgba(26, 255, 26, 0.4);

--shadow-glow-strong: 0 0 15px rgba(26, 255, 26, 1), 0 0 30px rgba(26, 255, 26, 0.8), 0 0 45px rgba(26, 255, 26, 0.6);
```

### Shadows

All shadows incorporate Matrix green tint instead of traditional black shadows:

- `--shadow-xs` through `--shadow-xl` use `rgba(26, 255, 26, x)`
- Creates cohesive glowing effect throughout the UI

## Components

### Buttons

Matrix-styled buttons with:

- Uppercase text with wide letter spacing
- Monospace font family
- Green glow effects on hover
- Thicker borders (2px) for stronger visual presence
- Hover state includes slight vertical translation

#### Button Variants

1. **Primary**: Solid Matrix green with strong glow
2. **Secondary**: Outlined with Matrix green border, fills on hover
3. **Ghost**: Minimal style, subtle hover effect
4. **Danger**: Red variant with red glow effect

## Spacing & Layout

- Uses 8pt grid system (`--space-1` through `--space-32`)
- Border radius kept minimal (`--radius-base`: 4px) for sharp, digital aesthetic

## Animation

- Fast transitions (`--duration-fast`: 150ms)
- Smooth easing (`--easing-ease-out`)
- Hover animations include glow intensity changes

## Accessibility

### Focus States

- Matrix green focus rings (`--color-focus-ring: #1aff1a`)
- 3px width with 2px offset for clear visibility
- Red focus rings for error states

### Contrast

- Black backgrounds with Matrix green text provide excellent contrast
- High contrast ensures WCAG AAA compliance (7:1 minimum)

## Usage Guidelines

### Do's ✅

- Use Matrix green (#1aff1a) for all interactive elements
- Apply glow effects to emphasize importance
- Use monospace fonts for code-like elements
- Maintain high contrast between text and background
- Use uppercase for buttons and headings

### Don'ts ❌

- Avoid using colors outside the Matrix palette
- Don't overuse glow effects (reserve for key interactions)
- Avoid rounded corners beyond `--radius-base`
- Do not mix serif fonts with the Matrix aesthetic

## File Locations

- **Tokens**: `/libs/shared/styles/src/tokens.css`
- **Global Styles**: `/libs/shared/styles/src/global.css`
- **Components**: `/libs/shared/ui/src/lib/`

## Inspiration

This design system pays homage to The Matrix (1999) and its iconic:

- Green cascading code (digital rain)
- Terminal/command-line interfaces
- Cyberpunk hacker aesthetic
- High-contrast digital world vs. real world

---

_"Welcome to the Real World."_ - Morpheus
