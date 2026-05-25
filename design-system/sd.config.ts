/**
 * Style Dictionary v5 config for the design-system token pipeline.
 *
 * Produces two build artifacts in design-system/dist/:
 *   tokens.css  — CSS custom properties with semantic tokens referencing primitives via var()
 *   tokens.json — flat key/value JSON (consumed by scripts/contrast-check.mjs)
 *
 * Token names are flat DTCG keys (e.g. "ds-green-500") at the root of each JSON file.
 * The css/variables format with outputReferences:true preserves inter-token references
 * so semantic aliases resolve to var(--ds-…) rather than inlined values.
 */
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['design-system/tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: '',
      buildPath: 'design-system/dist/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            selector: ':root',
            outputReferences: true,
          },
        },
      ],
    },
    json: {
      transformGroup: 'js',
      buildPath: 'design-system/dist/',
      files: [
        {
          destination: 'tokens.json',
          format: 'json/flat',
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();
