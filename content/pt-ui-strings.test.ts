import { describe, expect, it } from 'vitest';
import { dawMixer } from './daw-mixer';
import { guitarPresentation, guitarRig } from './guitar-rig';
import { NAVIGATION } from './navigation';
import { SITE_LOCALE } from './site-locale';

const EN = SITE_LOCALE.en;
const PT = SITE_LOCALE.pt;
const SHARED_DOCK_LABELS = ['MENU', 'SHELL'];

describe('pt interface strings below the fold are not the English ones', () => {
  it('translates the guitar camera, signal strip and chain labels', () => {
    const pairs: [string, string, string][] = [
      ['live cam status', guitarRig[EN].liveCam.status, guitarRig[PT].liveCam.status],
      ['live cam label', guitarRig[EN].liveCam.cameraLabel, guitarRig[PT].liveCam.cameraLabel],
      [
        'signal strip',
        guitarPresentation[EN].signalStrip.live,
        guitarPresentation[PT].signalStrip.live,
      ],
      [
        'input label',
        guitarPresentation[EN].signalChain[0].label,
        guitarPresentation[PT].signalChain[0].label,
      ],
      [
        'output label',
        guitarPresentation[EN].signalChain[2].label,
        guitarPresentation[PT].signalChain[2].label,
      ],
      ['amp name', guitarRig[EN].signalChain[1].name, guitarRig[PT].signalChain[1].name],
      [
        'influences',
        guitarPresentation[EN].influences.text,
        guitarPresentation[PT].influences.text,
      ],
    ];
    for (const [name, en, pt] of pairs) {
      expect(pt, `${name} reads "${en}" on /pt`).not.toBe(en);
    }
  });

  it('translates the mixer status', () => {
    expect(dawMixer[PT].status).not.toBe(dawMixer[EN].status);
  });

  it('keeps only product terms and the menu word identical in the pt dock', () => {
    const same = NAVIGATION[PT].dock
      .filter((control, index) => control.label === NAVIGATION[EN].dock[index]?.label)
      .map((control) => control.label);
    expect(same.sort()).toEqual(SHARED_DOCK_LABELS);
  });
});
