import { describe, expect, it } from 'vitest';
import { aboutContent } from './about';
import { dawMixer } from './daw-mixer';
import { SITE_LOCALE } from './site-locale';

const EN = SITE_LOCALE.en;
const PT = SITE_LOCALE.pt;

describe('DAW mixer channel terminal lines', () => {
  it('gives every pt channel the terminal lines its en twin has, in Portuguese', () => {
    const enChannels = dawMixer[EN].channels;
    const ptChannels = dawMixer[PT].channels;
    expect(ptChannels).toHaveLength(enChannels.length);
    enChannels.forEach((channel, index) => {
      const ptChannel = ptChannels[index];
      expect(ptChannel?.terminalLines?.length ?? 0, `${channel.id} pt terminalLines`).toBe(
        channel.terminalLines?.length ?? 0,
      );
      channel.terminalLines?.forEach((line, lineIndex) => {
        expect(
          ptChannel?.terminalLines?.[lineIndex],
          `${channel.id} pt terminal line ${lineIndex} is the en text`,
        ).not.toBe(line);
      });
    });
  });
});

describe('pt stack group labels', () => {
  it('names the language and data group like its en label, not just data', () => {
    const enGroup = aboutContent[EN].stack.groups.find((group) => group.items.includes('POSTGRES'));
    const ptGroup = aboutContent[PT].stack.groups.find((group) => group.items.includes('POSTGRES'));
    expect(enGroup?.label).toBe('LANG_DATA');
    expect(ptGroup?.label, 'the pt label must cover the TS and CSS chips too').toBe('LING_DADOS');
  });
});
