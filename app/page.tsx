import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageMain } from '@/components/PageMain';
import { About } from '@/components/sections/About';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { DawMixerSection } from '@/components/sections/DawMixerSection';
import { Footer } from '@/components/sections/Footer';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { Hero } from '@/components/sections/Hero';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { ManPageSection } from '@/components/sections/ManPageSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ShellSection } from '@/components/sections/ShellSection';
import { SysHealthSection } from '@/components/sections/SysHealthSection';
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
            <About />
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
            <GitLogSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <ManPageSection defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <SysHealthSection defer />
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
            <ContactSection defer />
          </ErrorBoundary>
        </PageMain>
        <ErrorBoundary>
          <Footer />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
