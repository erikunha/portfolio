// app/page.tsx — RSC composition root.
// All section components are imported here (RSC context), so their code and
// static data never ship to the client bundle. Only AppShell (nav/overlays)
// and section components that are explicitly 'use client' end up in JS.
//
// PPR (cacheComponents: true in next.config.ts): The static shell (Hero,
// ReadmeSection, ShellSection, NowSection, and all below-fold sections that
// don't branch by UA) is cached at the edge. Five dual-variant sections
// (ManPage, Guitar, Projects, GitLog, Visa) each wrap an async inner RSC
// inside <Suspense>; the inner RSC calls getIsMobile() → headers(), which
// makes those subtrees dynamic. The Suspense fallback (desktop variant) is
// included in the prerendered static shell, so the page is immediately usable
// on desktop with no streaming delay. Mobile users see the fallback flash for
// sub-millisecond UA resolution (no async I/O). Hero is intentionally outside
// any Suspense boundary so LCP is never gated on dynamic resolution.

import { AppShell } from '@/components/AppShell.client';
import { ErrorBoundary } from '@/components/ErrorBoundary.client';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { CommunitySection } from '@/components/sections/CommunitySection';
import { ContactSection } from '@/components/sections/ContactSection';
import { CredentialsSection } from '@/components/sections/CredentialsSection';
import { FooterLazy } from '@/components/sections/FooterLazy.client';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { Hero } from '@/components/sections/Hero';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { LivePerfSection } from '@/components/sections/LivePerfSection';
import { ManPageSection } from '@/components/sections/ManPageSection';
import { NowSection } from '@/components/sections/NowSection';
import { NpmStackSection } from '@/components/sections/NpmStackSection';
import { PerfReceiptsSection } from '@/components/sections/PerfReceiptsSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ReadmeSection } from '@/components/sections/ReadmeSection';
import { ResponsibilitiesSection } from '@/components/sections/ResponsibilitiesSection';
import { ShellSection } from '@/components/sections/ShellSection';
import { SysHealthSection } from '@/components/sections/SysHealthSection';
import { UnknownsSection } from '@/components/sections/UnknownsSection';
import { VisaSection } from '@/components/sections/VisaSection';
import { BreakpointProvider } from '@/lib/use-breakpoint.client';
import styles from './page.module.css';

export default function Home() {
  return (
    <BreakpointProvider initialIsMobile={false}>
      <AppShell>
        <main className={styles.page} id="main-content" tabIndex={-1}>
          <ErrorBoundary>
            <Hero />
          </ErrorBoundary>
          {/* Modules 0-3: above the fold on desktop and mobile — no deferral */}
          <ReadmeSection />
          <ShellSection />
          <ManPageSection />
          <NowSection />
          {/* Modules 4+: below the fold — defer content-visibility */}
          <ProjectsSection defer />
          <GitLogSection defer />
          <NpmStackSection defer />
          <SysHealthSection defer />
          <LivePerfSection defer />
          <AiMetricsSection defer />
          <PerfReceiptsSection defer />
          <GuitarSection defer />
          <VisaSection defer />
          <CredentialsSection defer />
          <CommunitySection defer />
          <HottestTakesSection defer />
          <ResponsibilitiesSection defer />
          <UnknownsSection defer />
          <ContactSection defer />
        </main>
        <ErrorBoundary>
          <FooterLazy />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
