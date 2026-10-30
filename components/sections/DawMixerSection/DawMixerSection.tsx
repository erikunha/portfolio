import { dawMixerUi } from '@/content/daw-mixer';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconMixer } from '../../Icons';
import { Module } from '../../responsive/Module';
import { DawMixerDesktop } from './DawMixerDesktop';

export function DawMixerContent() {
  return <DawMixerDesktop />;
}

export function DawMixerSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-daw-mixer"
      header={dawMixerUi.sectionHeader}
      srLabel={SECTION_LABELS['sec-daw-mixer']}
      icon={<IconMixer />}
      defer={defer}
      variant="green"
    >
      <DawMixerContent />
    </Module>
  );
}
