import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageMain } from '@/components/PageMain';
import { SiteShell } from '@/components/SiteShell';
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
import { localizedPath, type SiteLocale } from '@/content/site-locale';

const HOME_PATH = '/';

export function SiteHome({ locale }: { locale: SiteLocale }) {
  return (
    <SiteShell locale={locale} route={localizedPath(locale, HOME_PATH)}>
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
    </SiteShell>
  );
}
