import {
  ROOT_HTML_CLASS_NAME,
  RootShell,
  rootMetadata,
  rootViewport,
} from '@/components/RootShell';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.pt;

export const metadata = rootMetadata;

export const viewport = rootViewport;

export default function PtRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={SITE_HTML_LANG[locale]} className={ROOT_HTML_CLASS_NAME} suppressHydrationWarning>
      <RootShell locale={locale}>{children}</RootShell>
    </html>
  );
}
