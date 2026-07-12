import { describe, expect, it } from 'vitest';
import {
  PREVIEW_SOURCE_ARIA_LABEL_FALLBACK,
  previewSourceAriaLabel,
} from '../app/design-system/_components/preview.constants';

describe('previewSourceAriaLabel: unique per-component aria-label builder', () => {
  it('generates a label derived from the id', () => {
    const label = previewSourceAriaLabel('button');
    expect(label).toBe('button source code');
  });

  it('generates distinct labels for different ids', () => {
    const buttonLabel = previewSourceAriaLabel('button');
    const fieldLabel = previewSourceAriaLabel('field');
    expect(buttonLabel).not.toBe(fieldLabel);
    expect(buttonLabel).toBe('button source code');
    expect(fieldLabel).toBe('field source code');
  });

  it('produces 9 unique labels for all design-system component ids', () => {
    const componentIds = [
      'button',
      'field',
      'badge',
      'terminal-panel',
      'window-chrome',
      'stat-tile',
      'cmd-line',
      'kbd-key',
      'copybutton',
    ];
    const labels = componentIds.map(previewSourceAriaLabel);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size, `expected 9 unique labels, got ${uniqueLabels.size}`).toBe(9);
  });

  it('falls back to fallback constant when id is undefined', () => {
    const label = previewSourceAriaLabel(undefined);
    expect(label).toBe(PREVIEW_SOURCE_ARIA_LABEL_FALLBACK);
    expect(label).toBe('Component source code');
  });

  it('falls back to fallback constant when id is not provided', () => {
    const label = previewSourceAriaLabel();
    expect(label).toBe(PREVIEW_SOURCE_ARIA_LABEL_FALLBACK);
  });
});
