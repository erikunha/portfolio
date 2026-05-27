# Guitar Rig Redesign + DAW Mixer — Design Spec
**Date:** 2026-05-27  
**Status:** Approved for implementation planning

---

## Scope

Two sections, both in `app/page.tsx` with `defer`:

1. **GuitarSection** — complete visual redesign of the existing `sec-guitar` module. Stays 100% RSC (no client JS). Content schema replaced entirely.
2. **DawMixerSection** — brand new section, placed immediately after GuitarSection. RSC shell + 5 granular client islands (Option B). New `sec-daw-mixer` module ID.

Source of truth: design images provided by user (guitar rig desktop, guitar rig mobile × 2, daw mixer desktop, daw mixer mobile × 4).

---

## Section 1: Guitar Rig Redesign

### Module header

- Desktop: `← CAT ~/.GUITAR_RIG` (guitar icon, same `sec-guitar` ID)
- Mobile: same header, uses existing Module collapse behavior
- `TAIL -F ~/.RIG` label appears inside the section body (top-right of the inner panel), NOT in the module header

### Layout — Desktop (≥ 769px)

#### Row 1: Signal chain panel (full-width bordered box)

Status bar inside top of box:
- Left: `● SIGNAL_CHAIN.LIVE · SIGNAL OK` (small, muted green)
- Right: `TAIL -F ~/.RIG` (small, muted, right-aligned)

Four nodes in a CSS grid row with `→` arrows between each:
```
grid-template-columns: 1fr auto 1.6fr auto 1fr auto 1fr
```
Arrows: `→` in auto columns, vertically centered.

**Node structure** (all share same inner layout):
- `// LABEL` — small caps, dim green
- `NAME` — bold, large, signal green
- `subtitle` — dim, body size
- Strength dots — row of 8 square blocks, N filled (signal green), rest dim. Pixel-precise per node:
  - INPUT (GRETSCH G5655TG): 4 filled
  - AMP (MODELED CAB): 3 filled
  - OUT (FOH / IEM): 5 filled
  - FX: no dots — replaced by 2×4 block grid

**FX node special treatment** (wider column):
- 2 rows × 4 cols grid of effect pill buttons
- Each button: 1px border, name text, small `●` bullet in top-right corner if active
- Active = bright border + visible bullet. Inactive = dim border, no bullet
- Active blocks: COMP, OD, DLY, REV, EQ
- Inactive blocks: FUZZ, MOD, VOL

#### Row 2: Two-column panel

Left panel (≈ 73% width): **Influences queue**
- Border, padding
- Header line: `INFLUENCES.QUEUE · 5 LOADED` left + `// SHUFFLE OFF` right
- 5 entries: `▶01 NAME` (active, bold, signal color) / `02  NAME` (muted), right-aligned 5-square strength blocks
  - 01 John Mayer: 5/5
  - 02 Mateus Asato: 4/5
  - 03 Jimmy Page: 3/5 (first 3 bright, next 1 half-bright, 1 dim — render as 3 filled per design)
  - 04 John Frusciante: 3/5
  - 05 Iron Maiden's three: 2/5
- `now obsessing: Coldplay's "Yellow" — simplicity is hard.` — bold label, normal value, signal green

Right panel (≈ 27% width): **Live cam**
- Border, overflow hidden
- Top bar: `▶ REC · LIVE` (left, signal) + `CAM/01 · STAGE` (right, muted)
- Photo: `me_playing_guitar.jpg` — copied to `public/images/guitar-live.jpg`
  - CSS treatment: `filter: grayscale(1) brightness(0.5)` + green tint via `mix-blend-mode: multiply` on a `rgba(0,255,65,0.15)` overlay + scanlines repeating-linear-gradient + a horizontal animated scan beam (reuse `.bootCursor` / Hero CRT pattern already in codebase)
- Caption bar: `./GIGS --LIVE · SMALL VENUES · FEEL OVER NOISE` (small, muted green)

#### Row 3: Stats grid

Single bordered container, 4 equal cells, separated by `border-right`:
| // STYLE | // TUNING | // ALT RIG | // GIGS |
|---|---|---|---|
| **feel over noise** / lots of space | **standard E** / sometimes drop D | **Martin** / acoustic | **small venues** / band setting |

---

### Layout — Mobile (≤ 768px)

Inside the module: full-width bordered container.

**Signal chain — stacked vertical:**
- Status row: `● SIGNAL_CHAIN.LIVE · SIGNAL OK` line 1, `TAIL -F ~/.RIG` line 2
- Node 1: INPUT — full width box
- `▼` arrow centered between nodes
- Node 2: FX — full width box
  - Effect blocks rendered as **full-width rows** (not a grid), each: `● BLOCK_NAME` (active = bright bullet + bright border, inactive = dim bullet + dim border, no strikethrough)
  - Order: COMP, OD, FUZZ, DLY, REV, MOD, EQ, VOL
- `▼` arrow
- Node 3: AMP — full width box
- `▼` arrow
- Node 4: OUT — full width box

**Influences panel** — full width, same content as desktop

**Live cam** — full width, same CRT treatment, fills available width

**Stats grid** — 2×2 layout (STYLE + TUNING top row, ALT RIG + GIGS bottom row), single bordered container

---

### Content schema changes

Replace `content/guitar-rig.ts` + `GuitarRigSchema` in `content/schemas.ts`:

```typescript
type SignalChainNode = {
  role: 'INPUT' | 'FX' | 'AMP' | 'OUT';
  name: string;       // e.g. "GRETSCH G5655TG"
  subtitle: string;   // e.g. "Bigsby · hollow body"
  strengthDots?: number;  // 0–8, undefined for FX node
  blocks?: Array<{        // FX node only
    name: string;
    active: boolean;
  }>;
};

type Influence = {
  rank: number;
  name: string;
  strength: 1 | 2 | 3 | 4 | 5;  // new field
  active?: boolean;               // rank 1 = active (▶ prefix)
};

type StatCell = {
  label: string;   // e.g. "STYLE"
  value: string;   // e.g. "feel over noise"
  sub: string;     // e.g. "lots of space"
};

type GuitarRig = {
  signalChain: SignalChainNode[];  // exactly 4 items
  influences: Influence[];          // exactly 5 items
  nowObsessing: string;
  stats: StatCell[];                // exactly 4 items
  liveCam: {
    photo: string;   // public path, e.g. "/images/guitar-live.jpg"
    caption: string; // e.g. "./GIGS --LIVE · SMALL VENUES · FEEL OVER NOISE"
  };
};
```

---

## Section 2: DAW Mixer

### Module

- ID: `sec-daw-mixer`
- Header: `./MIX --LIVE — DAW MIXER`
- Icon: new `IconMixer` — three vertical bars `▐▐▐` (SVG or Unicode)
- `defer={true}` — below fold
- No `mobileHeader` variant needed (same header both viewports)

### Session header (RSC, inside module body, both viewports)

Desktop:
```
SESSION: YELLOW_TAKE_03.ALS · 5 GTR TRACKS + MASTER · ● MIXING     ▶ 00:01:24:08  |  87 BPM  |  4/4
```

Mobile (stacked):
```
SESSION: YELLOW_TAKE_03.ALS · ● MIXING
▶ 00:01:24:08  |  87 BPM  |  4/4

● 5 GTR + MASTER
TAP A ROW TO FOCUS
CH 02 = LEAD
```

---

### Desktop layout — table with 8 columns

Column headers row (dim, small caps):
`ID | TRACK | I/O | R/M/S | PLUGIN CHAIN | METER | FADER | DB`

Each channel row (6 total, separated by 1px bottom border):

| Column | Content |
|---|---|
| ID | `CH 01` badge + channel name small under it + a mini fader progress bar (thin, shows fader position visually) |
| TRACK | Bold channel name (`RHYTHM GTR`) + `// description...` below |
| I/O | Two circular knobs side by side, labeled GAIN + PAN (or WIDTH or LIMIT for special channels) |
| R/M/S | Three buttons: `R` `M` `S` (or `FX` `EQ` for MASTER), 1px border each |
| PLUGIN CHAIN | Up to 5 bordered boxes in a row, each: plugin name + `●` active indicator above + 5-dot strength bar below. Inactive = no border, plain text, no bullet |
| METER | Horizontal segmented bar (~14 segments), green fill + red for peak |
| FADER | Horizontal track with a small green thumb block at position |
| DB | Number (e.g. `+1.4`) + `dB` label |

**CH 02 (LEAD GTR)** has a highlighted left border (active/focused channel indicator).

**MASTER row** differences:
- Badge: `[MASTER]` styled differently (bracket style, no `CH`)
- Name: `2-BUSS — STEREO OUT`
- I/O knobs: COMP + LIMIT
- Buttons: `FX` `EQ`
- DB row also shows `LUFS -14 · PK -0.3` below the dB value

---

### Mobile layout — scrollable channel strips

Each channel = a bordered box with this internal structure (top to bottom):

1. **Header row**: `[CH 01]` badge (1px border) | `CHANNEL NAME` (large bold mono) | `+1.4 / dB` (right-aligned, stacked)
2. **Description**: `// Gretsch · clean strums...` (with inline `**bold**` for key words — e.g. "the voice", "5 gtr tracks")
3. **VU meter**: segmented horizontal bar (~14 segments). Green fills left-to-right based on `meterLevel`. Red segments for clipping (>0dB channels)
4. **Fader track**: thin horizontal track with a bordered green thumb block at `faderPosition %`
5. **Signal flow header**: `// SIGNAL FLOW` + small `●` bullet (dim color = collapsed; bright = expanded)
6. **Plugin rows**: `● PLUGIN_NAME` + 5-dot strength indicator right-aligned. Active = bright bullet + bright border row. Inactive = dim bullet + strikethrough-style dim text. Up to 5 visible initially.
7. **`▼` collapse**: if channel has more than 5 plugins OR always shown (see design — shown even at 5)
8. **Knobs row**: two `KnobIsland` circles side by side, each with label below (GAIN + PAN, or GAIN + WIDTH for PAD GTR, or COMP + LIMIT for MASTER)
9. **Button row**: `R` `M` `S` squares (or `FX` `EQ` for MASTER), 1px border each
10. **Footer bar**: thin full-width green line showing fader position. MASTER also shows `LUFS -14 · PK -0.3` right-aligned on this row.

After MASTER channel (mobile only), a **terminal output block**:
```
> headroom -3.2 · lufs -14 · pk -0.3 · mastered for streaming.
> same philosophy as code: fewer plugins, more space.
five tracks doing one job each beats fifteen tracks competing.
```
Monospaced, small font, dim green. Bold on `fewer plugins, more space`.

---

### Channel data (content/daw-mixer.ts)

```typescript
const channels = [
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
    knob1: { label: 'GAIN',  angleDeg: -40 },
    knob2: { label: 'PAN',   angleDeg: -25 },
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
    id: 'MASTER', name: '2-BUSS', desktopName: '2-BUSS — STEREO OUT',
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
];
```

---

### Client islands (Option B — granular, one per concern)

All live in `components/client/DawMixer/`:

#### `VuMeter.client.tsx`
- Props: `segments: number` (total), `initialLevel: number` (0–100), `clipping?: boolean`
- State: `level: number` (0–100), initialized from prop
- Interaction: pointer drag left/right changes `level`. On pointerdown capture, on pointermove update, on pointerup release.
- Render: `segments` count of `<span>` blocks. Fill = `Math.round(level / 100 * segments)`. Red segments: if `clipping` and level > 85, last 2 segments red.
- ARIA: `role="slider"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`, keyboard: ArrowLeft/ArrowRight ±5

#### `FaderIsland.client.tsx`
- Props: `initialPct: number` (0–100)
- State: `pct: number`
- Render: full-width track div, thumb positioned at `pct%` via `left: calc(${pct}% - thumbHalfWidth)`. Thumb = small bordered green square.
- Interaction: pointer drag on thumb, constrained to track bounds.
- ARIA: `role="slider"`, keyboard ArrowLeft/ArrowRight ±2

#### `KnobIsland.client.tsx`
- Props: `initialAngle: number` (degrees, -150 to +150), `label: string`
- State: `angle: number`
- Render: SVG circle (≈38px) with a line/needle from center to edge at `angle`. Matches the circular dial style in the design.
- Interaction: pointerdown records start angle, pointermove calculates delta from center, updates angle.
- ARIA: `role="slider"`, keyboard ArrowUp/ArrowDown ±5deg

#### `RmsButtons.client.tsx`
- Props: `buttons: string[]` (e.g. `['R','M','S']`), `initialActive: string[]`
- State: `active: Set<string>` (each button independently toggleable)
- Render: row of bordered button squares, active = signal-green background + dark text (inverted). Matches the `[M]` highlighted state in CH 05 design.
- ARIA: each button is `role="button"`, `aria-pressed`

#### `SignalFlow.client.tsx`
- Props: `plugins: Plugin[]`, `initialOpen?: boolean` (default true per design — all visible initially)
- State: `open: boolean`
- Render: plugin rows when open, `▼` toggle arrow (rotates 180deg when closed). When closed: shows `▼` + `// SIGNAL FLOW` label only.
- ARIA: toggle has `aria-expanded`

---

### CSS visual details

**Knob SVG** — two concentric circles, outer = track arc, inner = fill circle, line = needle:
```
stroke: var(--ds-color-signal-quiet)  // track
stroke: var(--ds-color-signal)        // needle line
```

**Plugin pill (desktop)** — bordered box:
```
border: 1px solid var(--ds-color-signal-quiet)
padding: 3px 8px
font-size: var(--ds-font-size-xs)
position: relative
```
Active bullet: `position: absolute; top: 2px; right: 2px; width: 5px; height: 5px; border-radius: 50%; background: var(--ds-color-signal)`

**Plugin row (mobile)** — full-width row:
```
display: flex; justify-content: space-between; align-items: center
padding: 5px 10px
border: 1px solid var(--ds-color-signal-quiet)  // active
color: var(--ds-color-text-muted)               // inactive
```

**Strength dots** — 5 inline squares (8×8px for guitar rig, 6×6px for mixer):
```
background: var(--ds-color-signal)      // filled
background: var(--ds-color-signal-quiet) // empty
```

**CH 02 focused border** (desktop): `border-left: 2px solid var(--ds-color-signal)` on the row.

**MASTER badge** different from channel badge: `font-weight: 700; border: 1px solid var(--ds-color-signal); padding: 2px 8px; letter-spacing: 0.12em`

---

## Files to create / modify

### New files
- `components/sections/GuitarSection/GuitarSection.tsx` — full replacement
- `components/sections/GuitarSection/GuitarSection.module.css` — full replacement
- `components/sections/DawMixerSection/DawMixerSection.tsx`
- `components/sections/DawMixerSection/DawMixerSection.module.css`
- `components/sections/DawMixerSection/index.ts`
- `components/client/DawMixer/VuMeter.client.tsx`
- `components/client/DawMixer/FaderIsland.client.tsx`
- `components/client/DawMixer/KnobIsland.client.tsx`
- `components/client/DawMixer/RmsButtons.client.tsx`
- `components/client/DawMixer/SignalFlow.client.tsx`
- `content/daw-mixer.ts`
- `public/images/guitar-live.jpg` — copy from `/Users/erikhenriquealvescunha/Downloads/me_playing_guitar.jpg`

### Modified files
- `content/guitar-rig.ts` — complete rewrite for new schema
- `content/schemas.ts` — add `GuitarRigSchema` v2 + `DawMixerSchema`
- `components/Icons/Icons.tsx` — add `IconMixer`
- `app/page.tsx` — add `<DawMixerSection defer />` after `<GuitarSection defer />`

### Tests needed
- `GuitarSection.test.tsx` — renders signal chain nodes, influences, stats; both viewports
- `VuMeter.test.tsx` — drag interaction changes level; ARIA attributes correct
- `FaderIsland.test.tsx` — drag changes position; ARIA correct
- `KnobIsland.test.tsx` — drag changes angle; ARIA correct
- `RmsButtons.test.tsx` — click toggles active state; aria-pressed correct
- `SignalFlow.test.tsx` — toggle open/close; aria-expanded correct
- `DawMixerSection.test.tsx` — renders all 6 channels; session header; desktop/mobile variants

---

## Performance notes

- GuitarSection: zero client JS, RSC only. Photo via Next.js `<Image>` with `sizes` and `priority={false}`.
- DawMixerSection: 5 island types × 6 channels = up to 30 island mounts, but each island is small (< 1KB gz). Total DAW Mixer client bundle target: < 6KB gz.
- VU meter drag uses `useRef` for pointer capture, not `useState` — only triggers paint on pointermove, not React re-render. (Same pattern as RoleTyper / HeroBootAnimation textContent mutation.)
- Fader and knob also use `useRef` for pointer capture; position applied via `element.style.setProperty` directly during drag, `useState` only on pointerup (final commit).

---

## Accessibility

- All interactive islands: pointer + keyboard equivalents
- VuMeter / Fader: `role="slider"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- Knob: `role="slider"` with degree value, `aria-label` includes channel name + parameter
- RmsButtons: `role="button"` with `aria-pressed`
- SignalFlow toggle: `aria-expanded` + `aria-controls`
- Photo: `alt="Erik playing guitar on stage, live show"` (descriptive)
- All interactive elements: `:focus-visible` ring using `var(--ds-color-signal)`

---

## Open questions / decisions made

- **Solo cross-channel**: solo is local per strip (highlights/dims that strip only, no cross-channel state). Consistent with Option B isolation.
- **VuMeter drag behavior**: draggable means the user can move the level bar left/right — purely visual/ephemeral. No audio playback implied.
- **FX blocks in Guitar Rig**: static display only — the blocks show active/inactive state from content data. Not interactive (user did not select plugin bypass in the interaction survey).
- **Photo CRT effect**: CSS-only treatment (grayscale + brightness + green overlay + scanlines). No canvas or WebGL.
- **Inline bold in descriptions**: `**text**` in desc strings gets parsed to `<strong>` during render. Simple regex replace in RSC, no markdown library needed.
