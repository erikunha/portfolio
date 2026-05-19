// app/page.tsx — RSC composition root.
// All section components are imported here (RSC context), so their code and
// static data never ship to the client bundle. Only AppShell (nav/overlays)
// and section components that are explicitly 'use client' end up in JS.
//
// STATIC: this route deliberately calls no dynamic APIs (headers / cookies /
// searchParams) so Next generates and serves it from the CDN edge cache.
// Sections that need UA detection (Projects / GitLog / Guitar / Visa / Module)
// call `getIsMobileForRequest()` *internally*; doing so there keeps the
// dynamic boundary scoped — those sections render dynamically while the page
// shell stays static. BreakpointProvider's `initialIsMobile={false}` sets
// the SSR snapshot to desktop; `useSyncExternalStore` then reads the real
// viewport on the client during hydration and re-renders the mobile chrome
// if needed. See docs/audit/2026-05-19-principal-audit.md (Theme 3) for
// the ~750-1000 ms LCP impact this static boundary unlocks.

import { AppShell } from '@/components/AppShell.client';
import { ErrorBoundary } from '@/components/ErrorBoundary.client';
import { CommunitySection } from '@/components/sections/CommunitySection';
import { ContactSection } from '@/components/sections/ContactSection';
import { CredentialsSection } from '@/components/sections/CredentialsSection';
import { Footer } from '@/components/sections/Footer';
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
import { BreakpointProvider } from '@/lib/use-breakpoint';

export const dynamic = 'force-static';

export default function Home() {
  return (
    <BreakpointProvider initialIsMobile={false}>
      <AppShell>
        <main className="page" id="main-content" tabIndex={-1}>
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
          <Footer />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
