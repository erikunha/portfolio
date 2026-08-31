import { type LinksContent, LinksContentSchema } from './schemas';
import { social } from './social';

export const linksContent: LinksContent = LinksContentSchema.parse({
  shellTitle: 'erik@gringa — bash',
  siteUrl: social.site,
  siteLabel: 'erikunha.dev',
  profile: {
    name: 'Erik Cunha',
    avatar: '/images/erik-avatar.jpg',
    taglines: {
      pt: [
        'Senior Full-Stack Engineer',
        'AI Engineering na prática',
        'Carreira internacional para devs',
      ],
      en: ['Senior Full-Stack Engineer', 'AI engineering, hands-on', 'Going global as a dev'],
    },
    host: { pt: 'Nova York, US · remoto', en: 'New York, US · remote' },
    stack: 'React · Next · Node · Claude/Codex',
    status: { pt: 'primeiros vídeos chegando', en: 'first videos landing soon' },
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
      accent: 'quaternary',
      tag: 'AI',
      title: { pt: 'AI Engineering na prática', en: 'AI engineering, hands-on' },
      description: {
        pt: 'Agentes, Claude/Codex, context engineering, workflows.',
        en: 'Agents, Claude/Codex, context engineering, workflows.',
      },
    },
    {
      id: 'carreira-internacional',
      accent: 'quinary',
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
      href: 'https://www.tiktok.com/@oeriknagringa',
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
    statusLabel: { pt: 'status', en: 'status' },
    channelHeading: { pt: 'o canal', en: 'the channel' },
    videosWord: { pt: 'vídeos', en: 'videos' },
    viewsWord: { pt: 'visualizações', en: 'views' },
    latestHeading: { pt: 'últimos vídeos', en: 'latest videos' },
    historyCommand: 'history -5',
    thumbPlaceholder: { pt: 'primeiro vídeo · 16:9', en: 'first video · 16:9' },
    historyEmpty: {
      pt: 'nenhuma entrada ainda · o primeiro vídeo aparece aqui sozinho',
      en: 'no entries yet · the first video lands here on its own',
    },
    seeAllVideos: { pt: 'ver todos os vídeos', en: 'see all videos' },
    playlistsHeading: { pt: 'playlists', en: 'playlists' },
    qrHeading: { pt: 'levar a página com você', en: 'take this page with you' },
    qrCommand: 'qrencode -o links.png',
    qrBody: {
      pt: 'Aponte a câmera para abrir esta página. Também serve para colar em vídeo, slide e crachá de evento.',
      en: 'Point your camera to open this page. Also works pasted into videos, slides and event badges.',
    },
    subscribe: { pt: 'inscrever-se no canal', en: 'subscribe' },
    subscribedCta: { pt: 'ver os últimos vídeos', en: 'see the latest videos' },
    watch: { pt: 'assistir', en: 'watch' },
    copyLink: { pt: 'copiar link', en: 'copy link' },
    copyDone: 'copied ✓',
    newBadge: { pt: 'novo', en: 'new' },
    langSwitchLabel: { pt: 'Idioma', en: 'Language' },
    feedUnavailable: {
      pt: 'Sem vídeos por aqui ainda. Inscreva-se para não perder o primeiro.',
      en: "No videos here yet. Subscribe so you don't miss the first one.",
    },
    skipToContent: { pt: 'Ir para o conteúdo', en: 'Skip to content' },
    pageHeading: {
      pt: 'Erik Cunha — links, canal e contato',
      en: 'Erik Cunha — links, channel and contact',
    },
  },
  meta: {
    title: {
      pt: 'Erik Cunha — AI Engineering e carreira internacional para devs',
      en: 'Erik Cunha — AI engineering and going global as a dev',
    },
    description: {
      pt: 'Senior Full-Stack Engineer em Nova York (remoto). Um vídeo novo toda semana no canal Erik na Gringa.',
      en: 'Senior Full-Stack Engineer in New York (remote). A new video every week on the Erik na Gringa channel.',
    },
  },
});
