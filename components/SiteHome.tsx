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
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';
import { BreakpointProvider } from '@/lib/use-breakpoint.client';

export function SiteHome({ locale }: { locale: SiteLocale }) {
  return (
    <BreakpointProvider initialIsMobile={false}>
      <AppShell
        brand={<BrandLink locale={locale} />}
        chrome={siteNavChrome(locale)}
        locale={locale}
        skipLabel={NAVIGATION[locale].copy.skipLabel}
      >
        <PageMain>
          <ErrorBoundary locale={locale}>
            <Hero locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <About locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <ShellSection locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <AiMetricsSection locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <ProjectsSection locale={locale} />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <GitLogSection locale={locale} defer />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <HottestTakesSection locale={locale} defer />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <GuitarSection locale={locale} defer />
          </ErrorBoundary>
          <ErrorBoundary locale={locale}>
            <ContactSection locale={locale} defer />
          </ErrorBoundary>
        </PageMain>
        <ErrorBoundary locale={locale}>
          <Footer locale={locale} />
        </ErrorBoundary>
      </AppShell>
    </BreakpointProvider>
  );
}
