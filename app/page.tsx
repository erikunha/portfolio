import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageMain } from '@/components/PageMain';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { CommunitySection } from '@/components/sections/CommunitySection';
import { ContactSection } from '@/components/sections/ContactSection';
import { CredentialsSection } from '@/components/sections/CredentialsSection';
import { DawMixerSection } from '@/components/sections/DawMixerSection';
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

export default function Home() {
  return (
    <BreakpointProvider initialIsMobile={false}>
      <AppShell>
        <PageMain>
          <ErrorBoundary>
            <Hero />
          </ErrorBoundary>
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
            <DawMixerSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <UnknownsSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <ContactSection defer />
          </ErrorBoundary>
        </PageMain>
        <ErrorBoundary>
          <FooterLazy />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
