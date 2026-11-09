import { MissingRoute } from '@/components/ErrorPages/MissingRoute';
import { SITE_LOCALE } from '@/content/site-locale';

export default function PtMissingRoute() {
  return <MissingRoute locale={SITE_LOCALE.pt} />;
}
