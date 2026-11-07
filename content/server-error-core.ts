import type { ErrorsContent } from './schemas';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';

export type ServerErrorCore = Pick<
  ErrorsContent['serverError'],
  'code' | 'message' | 'retryLabel' | 'home'
>;

const serverErrorCoreFor = (locale: SiteLocale): ServerErrorCore => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    code: '500',
    message: pt
      ? 'Algo quebrou do nosso lado. Tente de novo em um minuto.'
      : 'Something broke on our side. Try again in a minute.',
    retryLabel: pt ? 'TENTAR NOVAMENTE' : 'TRY AGAIN',
    home: { label: pt ? 'IR PARA O INÍCIO' : 'GO HOME', href: localizedPath(locale, '/') },
  };
};

export const serverErrorCore: Record<SiteLocale, ServerErrorCore> = {
  [SITE_LOCALE.en]: serverErrorCoreFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: serverErrorCoreFor(SITE_LOCALE.pt),
};
