import type { CopyFeedback, CopyFeedbackState } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const copyFeedbackFor = (locale: SiteLocale): Record<CopyFeedbackState, CopyFeedback> => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    idle: { label: pt ? 'COPIAR' : 'COPY', message: '' },
    success: {
      label: pt ? 'COPIADO' : 'COPIED',
      message: pt ? 'Copiado para a área de transferência.' : 'Copied to clipboard.',
    },
    failure: {
      label: pt ? 'FALHA AO COPIAR' : 'COPY FAILED',
      message: pt
        ? 'Falha ao copiar. Selecione e copie o texto manualmente.'
        : 'Copy failed. Select and copy the text manually.',
    },
    unavailable: {
      label: pt ? 'CÓPIA INDISPONÍVEL' : 'COPY UNAVAILABLE',
      message: pt
        ? 'Área de transferência indisponível. Selecione e copie o texto manualmente.'
        : 'Clipboard unavailable. Select and copy the text manually.',
    },
  };
};

export const copyFeedback: Record<SiteLocale, Record<CopyFeedbackState, CopyFeedback>> = {
  [SITE_LOCALE.en]: copyFeedbackFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: copyFeedbackFor(SITE_LOCALE.pt),
};
