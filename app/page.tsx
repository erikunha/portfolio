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
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const ua = (await headers()).get('user-agent');
  // ?force=desktop lets mobile users opt into the desktop layout.
  // initialIsMobile seeds SSR; the BreakpointProvider respects forceDesktop
  // on the client to prevent matchMedia from switching back.
  const forceDesktop = sp.force === 'desktop';
  const initialIsMobile = forceDesktop ? false : detectMobileFromUA(ua);

  return (
    <BreakpointProvider initialIsMobile={initialIsMobile} forceDesktop={forceDesktop}>
      <AppShell>
        <main className="page" id="main-content">
          <ErrorBoundary>
            <Hero />
          </ErrorBoundary>
          <ReadmeSection />
          <ShellSection />
          <ManPageSection />
          <NowSection />
          <ProjectsSection />
          <GitLogSection />
          <NpmStackSection />
          <SysHealthSection />
          <LivePerfSection />
          <PerfReceiptsSection />
          <GuitarSection />
          <VisaSection />
          <CredentialsSection />
          <CommunitySection />
          <HottestTakesSection />
          <ResponsibilitiesSection />
          <UnknownsSection />
          <ContactSection />
        </main>
        <ErrorBoundary>
          <Footer />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
