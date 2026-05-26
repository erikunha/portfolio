// app/page.tsx — RSC composition root.
// All section components are imported here (RSC context), so their code and
// static data never ship to the client bundle. Only AppShell (nav/overlays)
// and section components that are explicitly 'use client' end up in JS.
//
// PPR (cacheComponents: true in next.config.ts): The static shell (Hero,
// ReadmeSection, ShellSection, AiMetricsSection, ProjectsSection) is cached
// at the edge. AiMetricsSection is above the fold and wraps a Redis-bound
// async RSC in <Suspense>; its fallback (single-line pending stub) reserves
// the resolved grid height via min-height to prevent CLS. Five dual-variant
// sections (ManPage, Guitar, Projects, GitLog, Visa) each wrap an async inner
// RSC inside <Suspense>; the inner RSC calls getIsMobile() → headers(), which
// makes those subtrees dynamic. Only the Suspense fallback (desktop variant)
// is prerendered — the actual content streams on mobile UA resolution. Hero
// sits outside any Suspense boundary so LCP is never gated on dynamic
// resolution.

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { CommunitySection } from '@/components/sections/CommunitySection';
import { ContactSection } from '@/components/sections/ContactSection';
import { CredentialsSection } from '@/components/sections/CredentialsSection';
import { FooterLazy } from '@/components/sections/Footer';
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
          {/* Modules 1-4: above the fold — no deferral */}
          <ErrorBoundary>
            <ReadmeSection />
          </ErrorBoundary>
          <ErrorBoundary>
            <ShellSection />
          </ErrorBoundary>
          <ErrorBoundary>
            <AiMetricsSection />
          </ErrorBoundary>
          <ErrorBoundary>
            <ProjectsSection />
          </ErrorBoundary>
          {/* Modules 3+: below the fold — defer content-visibility */}
          <ErrorBoundary>
            <PerfReceiptsSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <ResponsibilitiesSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <NowSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <NpmStackSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <GitLogSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <ManPageSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <LivePerfSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <SysHealthSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <CredentialsSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <VisaSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <CommunitySection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <HottestTakesSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <GuitarSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <UnknownsSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <ContactSection defer />
          </ErrorBoundary>
        </main>
        <ErrorBoundary>
          <FooterLazy />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
