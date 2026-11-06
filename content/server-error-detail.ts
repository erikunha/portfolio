import type { ErrorsContent } from './schemas';
import { serverErrorCore } from './server-error-core';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const serverErrorContentFor = (locale: SiteLocale): ErrorsContent['serverError'] => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    ...serverErrorCore[locale],
    bootRender: pt ? 'render: exceção não tratada' : 'render: unhandled exception',
    bootReport: pt
      ? 'relatório enviado · stack mantida no servidor'
      : 'report sent · stack kept server-side',
    refLabel: 'ref',
    copyLabel: pt ? 'COPIAR' : 'COPY',
    copyAriaLabel: pt ? 'Copiar id de referência' : 'Copy reference id',
    copiedAnnouncement: pt ? 'Id de referência copiado' : 'Reference id copied',
  };
};

export const serverErrorContent: Record<SiteLocale, ErrorsContent['serverError']> = {
  [SITE_LOCALE.en]: serverErrorContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: serverErrorContentFor(SITE_LOCALE.pt),
};
