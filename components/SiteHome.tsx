import { AppShell } from '@/components/AppShell';
import { BrandLink } from '@/components/BrandLink';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageMain } from '@/components/PageMain';
import { About } from '@/components/sections/About';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { Footer } from '@/components/sections/Footer';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { Hero } from '@/components/sections/Hero';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ShellSection } from '@/components/sections/ShellSection';
import { siteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';
import { BreakpointProvider } from '@/lib/use-breakpoint.client';

export function SiteHome({ locale }: { locale: SiteLocale }) {
  return (
    <BreakpointProvider initialIsMobile={false}>
      <AppShell
        brand={<BrandLink />}
        chrome={siteNavChrome(locale)}
        locale={locale}
        skipLabel={locale === 'pt' ? 'Pular para o conteúdo' : 'Skip to main content'}
      >
        <PageMain>
          <ErrorBoundary>
            <Hero locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary>
            <About locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary>
            <ShellSection locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary>
            <AiMetricsSection locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary>
            <ProjectsSection locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary>
            <GitLogSection locale={locale} defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <HottestTakesSection locale={locale} defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <GuitarSection locale={locale} defer />
          </ErrorBoundary>
          <ErrorBoundary>
            <ContactSection locale={locale} defer />
          </ErrorBoundary>
        </PageMain>
        <ErrorBoundary>
          <Footer locale={locale} />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
