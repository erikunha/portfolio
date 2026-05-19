// app/page.tsx — RSC composition root.
// All section components are imported here (RSC context), so their code and
// static data never ship to the client bundle. Only AppShell (nav/overlays)
// and section components that are explicitly 'use client' end up in JS.

import { headers } from 'next/headers';
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
import { detectMobileFromUA } from '@/lib/breakpoint';
import { BreakpointProvider } from '@/lib/use-breakpoint';
export default async function Home() {
  const ua = (await headers()).get('user-agent');
  const initialIsMobile = detectMobileFromUA(ua);

  return (
    <BreakpointProvider initialIsMobile={initialIsMobile}>
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
