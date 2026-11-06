import { linksPageMetadata } from '@/app/_lib/links-metadata';
import { LinksPage } from '@/components/links/LinksPage';
import { LINKS_LOCALE } from '@/content/links.constants';

export const metadata = linksPageMetadata(LINKS_LOCALE.en);

export default function LinksEnPage() {
  return <LinksPage locale={LINKS_LOCALE.en} />;
}
