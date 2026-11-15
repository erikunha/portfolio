import { SITE_LOCALE, type SiteLocale } from './site-locale';

type LocalizedLabel = Readonly<Record<SiteLocale, string>>;

export const linksUi: {
  arrow: string;
  copyGlyph: string;
  prompt: string;
  qrLabel: LocalizedLabel;
  latestVideoLoading: LocalizedLabel;
} = {
  arrow: '→',
  copyGlyph: '⧉',
  prompt: '$ ',
  latestVideoLoading: {
    [SITE_LOCALE.pt]: 'Carregando o vídeo mais recente',
    [SITE_LOCALE.en]: 'Loading the latest video',
  },
  qrLabel: {
    [SITE_LOCALE.pt]: 'Código QR:',
    [SITE_LOCALE.en]: 'QR code:',
  },
};
