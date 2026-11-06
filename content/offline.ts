import type { OfflineNotice } from './shell-states.schema';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const offlineNotice: Record<SiteLocale, OfflineNotice> = {
  [SITE_LOCALE.en]: {
    badge: '○ NO SIGNAL',
    message: 'you are offline · forms will wait, pages already open still work',
  },
  [SITE_LOCALE.pt]: {
    badge: '○ SEM SINAL',
    message:
      'você está offline · os formulários esperam, as páginas já abertas continuam funcionando',
  },
};
