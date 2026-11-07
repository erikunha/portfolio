'use client';

import { usePathname } from 'next/navigation';
import { brandByLocale } from '@/content/brand';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import { localeOfPath, type SiteLocale } from '@/content/site-locale';
import { ErrorChrome } from './ErrorChrome.client';
import { type RouteErrorProps, ServerErrorMain, useErrorReport } from './ErrorPages.client';

const BRAND_IMAGE_SRC = '/icon.svg';
const BRAND_IMAGE_SIZE_PX = 28;

function ClientBrandLink({ locale }: { locale: SiteLocale }) {
  const brand = brandByLocale[locale];
  return (
    <a className="brand-link" href={brand.homeHref} aria-label={brand.accessibleName}>
      {/* biome-ignore lint/performance/noImgElement: a client boundary cannot import the inline SVG without shipping its path to every route; the static icon file carries the same mark */}
      <img src={BRAND_IMAGE_SRC} width={BRAND_IMAGE_SIZE_PX} height={BRAND_IMAGE_SIZE_PX} alt="" />
    </a>
  );
}

export function RouteErrorPage({ error, reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  const content = errorsContent[locale];
  const stamps = useErrorReport('[RouteError]', error);

  return (
    <>
      <ErrorChrome chrome={content.chrome} brand={<ClientBrandLink locale={locale} />} />
      <ServerErrorMain
        reset={reset}
        content={content.serverError}
        stamps={stamps}
        digest={error.digest}
      />
    </>
  );
}
