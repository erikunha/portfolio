# Multimodal evidence: looking at what the change renders

A review that talks about how a page looks, from measurements alone, is guessing. Geometry tells
you a box is 343 pixels wide; only the image tells you the nav wraps into six unreadable lines.
This file defines what counts as having looked, and what to write when looking was impossible.

## Which tracks owe a look

A track owes an image when its question is about appearance, and appearance is decided by pixels:

- design fidelity against the design authority
- responsive behaviour at a viewport
- accessibility of a rendered surface (focus ring, contrast, hit target, dialog overlay)
- motion, CRT effects, scanlines, flicker
- visual baseline impact
- any layout change that a human will see

A track about a route handler, a token, a Redis key or a prompt owes no image. Geometry
measurements belong to those tracks as supporting evidence.

## Three steps, and the order matters

1. **Capture.** A deterministic screenshot: fixed viewport, fixed state, the journey settled
   before the shot. Store it under a path you can name.
2. **Read.** Open the captured file with a tool that can read an image. Not its size, not its
   checksum, not the DOM that produced it. The image itself, looked at.
3. **Describe.** Write what the image shows: what is legible, what overlaps, what is cut, what
   moved. Quote the visible text when it matters.

Capture without reading is half the work and proves nothing. A pixel diff is arithmetic, not a
look. The DOM is the recipe, not the meal.

## What is not a look

- bounding boxes, offsets, computed styles
- a colour difference between two sampled pixels
- a screenshot that was written but never opened
- the design source rendered in another tool
- memory of what the page looked like earlier in the session

Those are measurements. They support a finding; they never replace the look that a visual finding
needs.

## Comparing against the base

When the change is supposed to look different, capture the base the same way: same viewport, same
state, same path. Then read both images. The finding names what changed between them, not what
one of them looks like alone.

When the change should look the same, compare against the design authority or the stored
baseline, with the same discipline.

## When looking is impossible

Missing capability is `BLOCKED`, never silent:

| Missing | Consequence |
| ------- | ----------- |
| no screenshot capability | the visual track is BLOCKED: nothing was captured |
| capture works, no image reader | the visual track is BLOCKED: the capture exists but was never read |
| image reader works, no driver | a stored baseline or a design export can still be read; a live capture cannot |

Write the limit in the draft with the missing capability named. A review that says "the visual
surface was not inspected" is honest and useful; one that silently drops the track is not.

## Recording

The completion matrix carries one row per visual track:

```
VISUAL: <what was captured> | READ: yes | no | not-available
SEEN: <one line: what the image showed>
COMPARED: <base | design authority | baseline | none>
```

`READ: no` on a visual track makes the track `BLOCKED`, whatever else it produced. The evidence
tag for an opened image is `IMAGE_OBSERVED`; a measurement stays `BROWSER_OBSERVED`.

## Why the rule exists

A reviewer's most common false positive is a visual finding read off a number: a margin that
looks wrong in a metric and is fine in the render, a contrast ratio computed on the wrong pair,
a section that appears taller than it is because of a font fallback. Every one of those is
caught by looking, and every one of them is a finding the author then has to disprove. Look
before you write the finding.
