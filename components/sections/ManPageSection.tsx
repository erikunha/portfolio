import { IconManPage } from '../Icons';
import { Module } from '../responsive/Module';
import { ManPageDesktop } from './ManPageDesktop';
import { ManPageMobile } from './ManPageMobile';

export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)" icon={<IconManPage />} defaultOpen={false}>
      <ManPageDesktop />
      <ManPageMobile />
    </Module>
  );
}
