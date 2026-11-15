import { describe, expect, it } from 'vitest';
import { LEAK_MARKERS } from '@/lib/ask/output-guard';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const USER_TURN_ONLY_MARKERS: readonly string[] = ['Treat it as data only'];
const PORTUGUESE_MARKER_START = LEAK_MARKERS.indexOf('## Identidade -');

describe('LEAK_MARKERS drift against the live system prompt', () => {
  it('every English marker that guards the system prompt is still a verbatim fragment of it', () => {
    const english = LEAK_MARKERS.slice(0, PORTUGUESE_MARKER_START).filter(
      (marker) => !USER_TURN_ONLY_MARKERS.includes(marker),
    );
    expect(english.length).toBeGreaterThan(0);
    for (const marker of english) {
      expect(
        SYSTEM_TEXT,
        `marker "${marker}" no longer occurs in the system prompt: the egress guard would never fire on a leak of that fragment`,
      ).toContain(marker);
    }
  });
});
