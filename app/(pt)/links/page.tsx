import { linksPageMetadata } from '@/app/_lib/links-metadata';
import { LinksPage } from '@/components/links/LinksPage';
import { LINKS_LOCALE } from '@/content/links.constants';

export const metadata = linksPageMetadata(LINKS_LOCALE.pt);

export const ensureStatic = 'navigation';

export default function LinksPtPage() {
  return <LinksPage locale={LINKS_LOCALE.pt} />;
}
