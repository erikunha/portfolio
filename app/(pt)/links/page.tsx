import { linksPageMetadata } from '@/app/_lib/links-metadata';
import { LinksPage } from '@/components/links/LinksPage';
import { SITE_LOCALE } from '@/content/site-locale';

export const metadata = linksPageMetadata(SITE_LOCALE.pt);

export const ensureStatic = 'navigation';

export default function LinksPtPage() {
  return <LinksPage locale={SITE_LOCALE.pt} />;
}
