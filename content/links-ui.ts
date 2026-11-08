import { LINKS_LOCALE, type LinksLocale } from './links.constants';

type LocalizedLabel = Readonly<Record<LinksLocale, string>>;

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
    [LINKS_LOCALE.pt]: 'Carregando o vídeo mais recente',
    [LINKS_LOCALE.en]: 'Loading the latest video',
  },
  qrLabel: {
    [LINKS_LOCALE.pt]: 'Código QR:',
    [LINKS_LOCALE.en]: 'QR code:',
  },
};
