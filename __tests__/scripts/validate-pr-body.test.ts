import { describe, expect, it } from 'vitest';
import { isSectionFilled } from '@/scripts/validate-pr-body';

function body(...sections: [heading: string, content: string][]): string {
  return sections.map(([h, c]) => `## ${h}\n\n${c}`).join('\n\n');
}

describe('isSectionFilled', () => {
  it('returns true when section has real content', () => {
    const b = body(['Summary', 'Adds mobile font-size fixes.']);
    expect(isSectionFilled('Summary', b)).toBe(true);
  });

  it('returns false when heading is absent', () => {
    expect(isSectionFilled('Summary', '## Other\n\nsome text')).toBe(false);
  });

  it('returns false when section is empty', () => {
    const b = body(['Summary', '']);
    expect(isSectionFilled('Summary', b)).toBe(false);
  });

  it('returns false for HTML comment only', () => {
    const b = body(['Summary', '<!-- What changed and why. -->']);
    expect(isSectionFilled('Summary', b)).toBe(false);
  });

  it('returns false for bare unchecked checkbox only', () => {
    const b = body(['Type of change', '- [ ]']);
    expect(isSectionFilled('Type of change', b)).toBe(false);
  });

  it('returns false for bare bullet placeholder (lone hyphen)', () => {
    const b = body(['Summary', '-\n-']);
    expect(isSectionFilled('Summary', b)).toBe(false);
  });

  it('returns false for mix of comments and bare bullets only', () => {
    const b = body(['Summary', '<!-- explain here -->\n-\n-']);
    expect(isSectionFilled('Summary', b)).toBe(false);
  });

  it('returns true when a checkbox has text after it', () => {
    const b = body(['Type of change', '- [x] `fix` — bug fix']);
    expect(isSectionFilled('Type of change', b)).toBe(true);
  });

  it('returns true when an unchecked checkbox has trailing text', () => {
    const b = body(['Type of change', '- [ ] `feat` — new feature']);
    expect(isSectionFilled('Type of change', b)).toBe(true);
  });

  it('does not bleed into the next section', () => {
    const b = '## Summary\n\n-\n\n## Type of change\n\n- [x] `fix` — bug fix';
    expect(isSectionFilled('Summary', b)).toBe(false);
    expect(isSectionFilled('Type of change', b)).toBe(true);
  });

  it('returns true for a bullet with real content', () => {
    const b = body(['Summary', '- Fixed mobile cmdbar font size']);
    expect(isSectionFilled('Summary', b)).toBe(true);
  });

  it('returns false for a multi-line HTML comment only', () => {
    const b = body(['Summary', '<!--\nWhat changed and why.\n2-3 bullets.\n-->']);
    expect(isSectionFilled('Summary', b)).toBe(false);
  });

  it('returns false for multi-line comment mixed with bare bullets', () => {
    const b = body(['Summary', '<!--\nexplain here\n-->\n-\n-']);
    expect(isSectionFilled('Summary', b)).toBe(false);
  });

  it('does not bleed through indented headings', () => {
    const b = '## Summary\n\n-\n\n  ## Type of change\n\n- [x] `fix` — bug fix';
    expect(isSectionFilled('Summary', b)).toBe(false);
    expect(isSectionFilled('Type of change', b)).toBe(true);
  });

  it('returns false when template file placeholder (lone hyphen) is left in place', () => {
    const templateDefault = '## Summary\n\n<!-- What changed and why. 2-3 bullets. -->\n\n-\n-\n';
    expect(isSectionFilled('Summary', templateDefault)).toBe(false);
  });
});
