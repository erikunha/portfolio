import { MissingRoute } from '@/components/ErrorPages/MissingRoute';
import { SITE_LOCALE } from '@/content/site-locale';

export default function EnMissingRoute() {
  return <MissingRoute locale={SITE_LOCALE.en} />;
}
