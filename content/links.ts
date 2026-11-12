import { OPENS_IN_NEW_TAB } from './company-link';
import { profile, profilePresentation, profileStack } from './profile';
import { type LinksContent, LinksContentSchema } from './schemas';
import { SITE_LOCALE } from './site-locale';
import { social } from './social';

const LINKS_STACK_SEPARATOR = ' · ';

export const linksContent: LinksContent = LinksContentSchema.parse({
  shellTitle: 'erik@gringa · bash',
  siteUrl: social.site,
  siteLabel: 'erikunha.dev',
  profile: {
    name: profile.displayName,
    avatar: '/images/erik-avatar.jpg',
    taglines: {
      pt: [
        profilePresentation[SITE_LOCALE.pt].title,
        'AI Engineering na prática',
        'Carreira internacional para devs',
      ],
      en: [
        profilePresentation[SITE_LOCALE.en].title,
        'AI engineering, hands-on',
        'Going global as a dev',
      ],
    },
    host: {
      pt: `${profilePresentation[SITE_LOCALE.pt].country} · remoto (${profile.currentEmployer.name}, Nova York)`,
      en: `${profilePresentation[SITE_LOCALE.en].country} · remote (${profile.currentEmployer.name}, New York)`,
    },
    stack: profileStack.all.join(LINKS_STACK_SEPARATOR),
  },
  channel: {
    id: 'UCZ1P4Pqpo-j_uAHaIc_pGrA',
    handle: '@eriknagringa',
    name: 'Erik Na Gringa',
  },
  upcoming: {
    label: { pt: 'próximo vídeo', en: 'next video' },
    topic: {
      pt: 'canal novo · AI engineering e carreira internacional para devs',
      en: 'new channel · AI engineering and going global as a dev',
    },
    slot: { pt: 'em breve', en: 'soon' },
  },
  playlists: [
    {
      id: 'ai-engineering',
      tag: 'AI',
      title: { pt: 'AI Engineering na prática', en: 'AI engineering, hands-on' },
      description: {
        pt: 'Agentes, Claude/Codex, context engineering, workflows.',
        en: 'Agents, Claude/Codex, context engineering, workflows.',
      },
    },
    {
      id: 'carreira-internacional',
      tag: 'INTL',
      title: { pt: 'Carreira internacional para devs', en: 'Going global as a dev' },
      description: {
        pt: 'Remoto para EUA, Malta e Canadá: processos, salários e vida fora.',
        en: 'Remote for the US, Malta and Canada: interviews, salaries, life abroad.',
      },
    },
  ],
  pills: [
    {
      id: 'portfolio',
      icon: 'portfolio',
      label: { pt: 'Portfólio', en: 'Portfolio' },
      href: social.site,
    },
    { id: 'github', icon: 'github', label: { pt: 'GitHub', en: 'GitHub' }, href: social.github },
    {
      id: 'linkedin',
      icon: 'linkedin',
      label: { pt: 'LinkedIn', en: 'LinkedIn' },
      href: social.linkedin,
    },
    { id: 'instagram', icon: 'instagram', label: { pt: 'Instagram', en: 'Instagram' } },
    {
      id: 'tiktok',
      icon: 'tiktok',
      label: { pt: 'TikTok', en: 'TikTok' },
      href: 'https://www.tiktok.com/@eriknagringaa',
    },
    {
      id: 'email',
      icon: 'email',
      label: { pt: 'e-mail', en: 'e-mail' },
      href: `mailto:${social.email}`,
    },
  ],
  copy: {
    whoami: 'whoami',
    hostLabel: { pt: 'host', en: 'host' },
    stackLabel: { pt: 'stack', en: 'stack' },
    watchHeading: { pt: 'assistir', en: 'watch' },
    profilesHeading: { pt: 'perfis', en: 'profiles' },
    contactHeading: { pt: 'contato', en: 'contact' },
    emailHint: { pt: 'falar comigo', en: 'say hello' },
    videosWord: { pt: 'vídeos', en: 'videos' },
    viewsWord: { pt: 'visualizações', en: 'views' },
    latestHeading: { pt: 'últimos vídeos', en: 'latest videos' },
    historyCommand: 'history -5',
    thumbPlaceholder: { pt: 'último vídeo · 16:9', en: 'latest video · 16:9' },
    historyEmpty: {
      pt: 'a lista não carregou · recarregue em um minuto ou abra o canal',
      en: 'the list did not load · reload in a minute or open the channel',
    },
    historyOnlyLatest: {
      pt: 'o vídeo mais recente é o único até agora · abra o canal para ver mais',
      en: 'the latest video is the only one so far · open the channel to see more',
    },
    seeAllVideos: { pt: 'ver todos os vídeos', en: 'see all videos' },
    playlistsHeading: { pt: 'playlists', en: 'playlists' },
    qrHeading: { pt: 'levar a página com você', en: 'take this page with you' },
    qrCommand: 'qrencode -o links.png',
    qrBody: {
      pt: 'Aponte a câmera para abrir esta página. Também serve para colar em vídeo, slide e credencial de evento.',
      en: 'Point your camera to open this page. Also works pasted into videos, slides and event badges.',
    },
    subscribe: { pt: 'inscrever-se no canal', en: 'subscribe' },
    subscribedCta: { pt: 'ver os últimos vídeos', en: 'see the latest videos' },
    watch: { pt: 'assistir', en: 'watch' },
    copyLink: { pt: 'copiar link', en: 'copy link' },
    copyDone: { pt: 'copiado ✓', en: 'copied ✓' },
    copyFailed: { pt: 'falha ao copiar', en: 'copy failed' },
    copyFailedMessage: {
      pt: 'Falha ao copiar. Copie o endereço na barra do navegador.',
      en: 'Copy failed. Copy the address from the browser bar.',
    },
    opensInNewTab: OPENS_IN_NEW_TAB,
    newBadge: { pt: 'novo', en: 'new' },
    feedUnavailable: {
      pt: 'O último vídeo não carregou agora. Recarregue em um minuto ou abra o canal.',
      en: 'The latest video did not load just now. Reload in a minute or open the channel.',
    },
    pageHeading: {
      pt: 'Erik Cunha · links, canal e contato',
      en: 'Erik Cunha · links, channel and contact',
    },
  },
  meta: {
    title: {
      pt: 'Erik Cunha · AI Engineering e carreira internacional para devs',
      en: 'Erik Cunha · AI engineering and going global as a dev',
    },
    description: {
      pt: 'Engenheiro de Software Sênior, Engenheiro de IA, no Brasil e remoto. Um vídeo novo toda semana no canal Erik na Gringa.',
      en: 'Senior Software Engineer, AI Engineer, Brazil-based and remote. A new video every week on the Erik na Gringa channel.',
    },
  },
});
