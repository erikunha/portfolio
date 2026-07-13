import { Suspense } from 'react';
import { SECTION_LABELS } from '@/content/section-labels';
import { getIsMobile } from '@/lib/ua';
import { IconManPage } from '../../Icons';
import { Module } from '../../responsive/Module';
import { ManPageDesktop } from './ManPageDesktop';
import { ManPageMobile } from './ManPageMobile';

export async function ManPageContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <ManPageMobile /> : <ManPageDesktop />;
}

export function ManPageSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-man-page"
      header="MAN ERIK(1)"
      srLabel={SECTION_LABELS['sec-man-page']}
      icon={<IconManPage />}
      defer={defer}
      variant="green"
    >
      <Suspense fallback={<ManPageDesktop />}>
        <ManPageContent />
      </Suspense>
    </Module>
  );
}
