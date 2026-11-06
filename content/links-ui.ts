import { LINKS_LOCALE, type LinksLocale } from './links.constants';

type LocalizedLabel = Readonly<Record<LinksLocale, string>>;

export const linksUi: {
  arrow: string;
  qrLabel: LocalizedLabel;
} = {
  arrow: '→',
  qrLabel: {
    [LINKS_LOCALE.pt]: 'Código QR:',
    [LINKS_LOCALE.en]: 'QR code:',
  },
};
