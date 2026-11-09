import { describe, expect, it } from 'vitest';
import { heroClientContent } from '@/content/hero-client';
import { SITE_LOCALE } from '@/content/site-locale';
import { BLANK_BOOT_LINE, desktopBootLines } from '@/lib/boot-animation';

function plainText(parts: readonly (string | { text: string })[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.text)).join('');
}

describe('desktopBootLines', () => {
  it.each(Object.values(SITE_LOCALE))('renders the %s boot sequence from its copy', (locale) => {
    const copy = heroClientContent[locale];
    const lines = desktopBootLines(copy).map(plainText);
    expect(lines[0]).toBe(copy.bootSequenceLine);
    expect(lines[1], 'a blank line keeps its height only as a no-break space').toBe(
      BLANK_BOOT_LINE,
    );
    copy.bootSteps.forEach((step, index) => {
      const status = step.status === 'ok' ? copy.bootStatus.ok : copy.bootStatus.encrypted;
      expect(lines[2 + index], `step ${index} pairs its label with its status`).toBe(
        `${step.label} ${status}`,
      );
    });
    expect(lines.at(-2)).toBe(copy.bootWelcome);
    expect(lines.at(-1)).toBe(BLANK_BOOT_LINE);
  });

  it('marks ok and encrypted steps with their own highlight classes', () => {
    const copy = heroClientContent[SITE_LOCALE.pt];
    const lines = desktopBootLines(copy);
    copy.bootSteps.forEach((step, index) => {
      const tail = lines[2 + index]?.at(-1);
      expect(typeof tail === 'object' && tail.cls).toBe(
        step.status === 'ok' ? 'bootOk' : 'bootEnc',
      );
    });
  });
});
