import { Suspense } from 'react';
import { getIsMobile } from '@/lib/ua';
import { IconManPage } from '../Icons';
import { Module } from '../responsive/Module';
import { ManPageDesktop } from './ManPageDesktop';
import { ManPageMobile } from './ManPageMobile';

export async function ManPageContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <ManPageMobile /> : <ManPageDesktop />;
}

export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)" icon={<IconManPage />}>
      <Suspense fallback={<ManPageDesktop />}>
        <ManPageContent />
      </Suspense>
    </Module>
  );
}
