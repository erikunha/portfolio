import { describe, expect, it } from 'vitest';
import { productionSources } from '../helpers/production-sources';

const HOOK_FILE = 'components/client/DawMixer/useDragSlider.client.ts';
const POINTER_CAPTURE_CALL = /\.setPointerCapture\(/;

describe('pointer-drag slider state machine', () => {
  it('lives only in useDragSlider, not copied into each island', () => {
    const copies = [...productionSources(['components'])]
      .filter(([file, text]) => file !== HOOK_FILE && POINTER_CAPTURE_CALL.test(text))
      .map(([file]) => file);
    expect(
      copies,
      'a fix to pointer capture or cancel-revert must be made once; use useDragSlider',
    ).toEqual([]);
  });
});
