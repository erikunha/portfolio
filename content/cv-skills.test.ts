import { describe, expect, it } from 'vitest';
import { cvDocument } from './reading-views';
import { CvDocumentSchema } from './schemas';
import { SITE_LOCALE, SITE_LOCALES } from './site-locale';

const MAX_ITEM_CHARS = 160;

describe('CV skills content', () => {
  for (const locale of SITE_LOCALES) {
    const { skills } = cvDocument[locale];

    it(`${locale}: every category has a label and its own list of items`, () => {
      expect(skills.length).toBeGreaterThan(0);
      for (const group of skills) {
        expect(typeof group, 'a skill category is an object, not a "Label: a, b" string').toBe(
          'object',
        );
        expect(group.label.length).toBeGreaterThan(0);
        expect(group.label, 'the label carries no separator, the markup draws it').not.toContain(
          ':',
        );
        expect(group.items.length, `${group.label} lists no items`).toBeGreaterThan(1);
      }
    });

    it(`${locale}: no item is a paragraph in disguise`, () => {
      for (const group of skills) {
        for (const item of group.items) {
          expect(
            item.length,
            `"${item}" in ${group.label} is too long to scan as one skill`,
          ).toBeLessThanOrEqual(MAX_ITEM_CHARS);
        }
      }
    });
  }

  it('both locales list the same categories with the same number of items', () => {
    const shape = (locale: (typeof SITE_LOCALES)[number]) =>
      cvDocument[locale].skills.map((group) => group.items.length);
    expect(shape(SITE_LOCALE.pt), 'pt skills must mirror the en categories').toEqual(
      shape(SITE_LOCALE.en),
    );
  });

  it('the schema rejects a skills list given as flat strings', () => {
    const flat = { ...cvDocument[SITE_LOCALE.en], skills: ['LLM Systems: eval, tracing'] };
    expect(CvDocumentSchema.safeParse(flat).success).toBe(false);
  });
});
