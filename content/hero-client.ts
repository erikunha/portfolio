import type { HeroClientContent } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const BOOT_PROMPT = 'erik@portfolio:~$';
const BOOT_COMMAND = 'run bio.exe --verbose';

const heroClientContentFor = (locale: SiteLocale): HeroClientContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    systemFailurePlate: pt ? 'FALHA DO SISTEMA' : 'SYSTEM FAILURE',
    bootStaticDialogLine: pt ? 'A Matrix tem você...' : 'The Matrix has you...',
    bootSequenceLine: pt ? '[SEQUÊNCIA DE BOOT INICIADA]' : '[SYSTEM BOOT SEQUENCE INITIATED]',
    bootPrompt: BOOT_PROMPT,
    bootCommand: BOOT_COMMAND,
    bootSteps: [
      {
        label: pt ? 'Inicializando módulos do kernel...' : 'Initializing kernel modules...',
        status: 'ok',
      },
      {
        label: pt ? 'Montando sistemas de arquivos locais...' : 'Mounting local filesystems...',
        status: 'ok',
      },
      {
        label: pt ? 'Iniciando serviços de rede...' : 'Starting network services...',
        status: 'ok',
      },
      {
        label: pt ? 'Carregando protocolos de segurança...' : 'Loading security protocols...',
        status: 'encrypted',
      },
    ],
    bootStatus: {
      ok: 'OK',
      encrypted: pt ? '[CRIPTOGRAFADO]' : '[ENCRYPTED]',
    },
    bootWelcome: pt
      ? 'Bem-vindo ao DEV_OS v2.0.4-stable [usuário: erik]'
      : 'Welcome to DEV_OS v2.0.4-stable [user: erik]',
    bootDialogDesktop: pt
      ? ['Acorde, Neo...', 'Acorde...', 'A Matrix tem você...', 'Toc, toc, Neo...']
      : ['Wake up, Neo...', 'Wake up...', 'The Matrix has you...', 'Knock, knock, Neo...'],
    bootDialogMobile: pt
      ? ['Acorde, Neo...', 'A Matrix tem você...', 'Toc, toc, Neo...']
      : ['Wake up, Neo...', 'The Matrix has you...', 'Knock, knock, Neo...'],
  };
};

export const heroClientContent: Record<SiteLocale, HeroClientContent> = {
  [SITE_LOCALE.en]: heroClientContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: heroClientContentFor(SITE_LOCALE.pt),
};
