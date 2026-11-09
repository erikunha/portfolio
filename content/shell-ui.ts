import type { ShellUi } from './schemas';

export type { ShellUi };

import type { ShellStates } from './shell-states.schema';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { EMAIL_ADDRESS } from './social-urls';

export const ShellCommand = {
  Help: 'help',
  WhoIs: 'whois',
  WhoAmI: 'whoami',
  WhoIsRecursive: 'whois --recursive',
  WhoAmIRecursive: 'whoami --recursive',
  Skills: 'cat skills.md',
  Now: 'cat ~/.now',
  Contact: 'contact',
  Clear: 'clear',
  Privacy: 'privacy',
  AskPrefix: 'ask ',
} as const;

export const ShellLineKind = {
  Prompt: 'prompt',
  Output: 'output',
  Error: 'error',
  Info: 'info',
  Loading: 'loading',
  Reference: 'reference',
  Hint: 'hint',
  RateLimit: 'ratelimit',
} as const;

export const SHELL_LIMITS = {
  logEntries: 50,
  commandHistory: 50,
  requestTimeoutMs: 15_000,
  placeholderTypeMs: 60,
  placeholderHoldMs: 1800,
  placeholderBackMs: 30,
  placeholderPauseMs: 300,
} as const;

export const SHELL_STATE_TOKEN = {
  seconds: '{seconds}',
  left: '{left}',
  count: '{count}',
  target: '{target}',
} as const;

export function fillShellState(
  template: string,
  values: Partial<Record<keyof typeof SHELL_STATE_TOKEN, string>>,
): string {
  let filled = template;
  for (const key of Object.keys(values) as (keyof typeof SHELL_STATE_TOKEN)[]) {
    filled = filled.replace(SHELL_STATE_TOKEN[key], values[key] ?? '');
  }
  return filled;
}

export const shellStates: Record<SiteLocale, ShellStates> = {
  [SITE_LOCALE.en]: {
    thinkingElapsed: '[ thinking {seconds}s ]',
    escStop: '[ Esc ] stop',
    stderrCommand: 'ask:',
    timeoutName: 'timeout',
    timeoutBody: 'the model went quiet for {seconds}s. The partial answer above is kept.',
    retry: '[ RETRY ]',
    retryLabel: 'Retry the last question',
    tryPrefix: 'try:',
    tryCommand: ShellCommand.Skills,
    trySuffix: '(works offline) or write to',
    slowDown: '! slow down: {left} until the next question',
    minutesUnit: 'min',
    secondsUnit: 's',
    localCommands: 'Local commands keep working meanwhile: help, cat skills.md, whoami.',
    rateLimitReady: '> ready: you can ask again',
  },
  [SITE_LOCALE.pt]: {
    thinkingElapsed: '[ pensando {seconds}s ]',
    escStop: '[ Esc ] parar',
    stderrCommand: 'ask:',
    timeoutName: 'timeout',
    timeoutBody: 'o modelo ficou em silêncio por {seconds}s. A resposta parcial acima foi mantida.',
    retry: '[ TENTAR DE NOVO ]',
    retryLabel: 'Tentar de novo a última pergunta',
    tryPrefix: 'tente:',
    tryCommand: ShellCommand.Skills,
    trySuffix: '(funciona offline) ou escreva para',
    slowDown: '! vá com calma: {left} até a próxima pergunta',
    minutesUnit: 'min',
    secondsUnit: 's',
    localCommands:
      'Os comandos locais continuam funcionando enquanto isso: help, cat skills.md, whoami.',
    rateLimitReady: '> pronto: você já pode perguntar de novo',
  },
};

export const shellLoadingLabel: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'Loading interactive shell',
  [SITE_LOCALE.pt]: 'Carregando shell interativo',
};

export const shellUi: Record<SiteLocale, ShellUi> = {
  [SITE_LOCALE.en]: {
    welcome: 'Connected. Type help to list commands, or ask me anything about Erik.',
    mobileWelcome: 'welcome. type help, or fill the prompt from a chip.',
    inputLabel: 'shell command',
    outputLabel: 'shell output',
    toolbarLabel: 'Shell shortcuts',
    prompt: 'erik@portfolio:~$',
    placeholder: 'type a command or ask about Erik…',
    suggestions: [
      ShellCommand.Help,
      ShellCommand.WhoIs,
      ShellCommand.Skills,
      ShellCommand.Now,
      'what are your strongest projects?',
      'what do you build with agents and LLMs?',
    ],
    commands: [
      ShellCommand.Help,
      ShellCommand.WhoIs,
      ShellCommand.Skills,
      ShellCommand.Now,
      ShellCommand.Contact,
      ShellCommand.Privacy,
      ShellCommand.Clear,
    ],
    commandHint: 'anything else → Claude',
    aiLabel: '[AI] Claude',
    thinking: 'thinking...',
    stop: '[STOP]',
    stopLabel: 'Stop answer',
    stoppedBefore: 'stopped before an answer. No answer was received.',
    stoppedPartial: 'stopped. The answer above is incomplete.',
    started: 'answer started',
    complete: 'answer complete',
    commandComplete: 'Command complete',
    cleared: 'log cleared',
    busy: 'An answer is in progress. Stop it before submitting another command. Your draft is kept.',
    empty: '(empty response)',
    errorPrefix: 'error:',
    serverError: 'The server could not answer. Try again in a minute.',
    requestTooLarge: 'That question is too long. Shorten it and try again.',
    answerWithheld: 'The answer was stopped by a safety check. Try rephrasing the question.',
    bodyUnavailable: 'response body unavailable',
    offline: 'offline: reconnect to ask Claude. Built-in commands still work.',
    networkError: 'Connection failed. Reconnect and retry. Built-in commands still work.',
    localAvailable: 'Built-in commands still work.',
    referencePrefix: 'ref',
    trailerPrefix: '-- req=',
    forgetting: 'FORGETTING...',
    forgetDeleted: '✓ done, no record kept under this id',
    forgetFailed: '! could not delete, try again',
    forgetRateLimited: '! too many deletions, try again in {left}',
    privacyEmpty: 'this session has not logged any request.',
    privacyHeader: 'requests logged this session: {count}',
    privacyUsage: 'usage: privacy | privacy forget <number|id> | privacy forget --all',
    privacyUnknown: '! no request {target} in this session.',
    privacyNotAttempted: '{count} not attempted, run it again after the wait.',
    copy: 'COPY',
    forget: 'FORGET',
    copied: 'COPIED',
    copyFailed: 'COPY FAILED',
    copiedAnnouncement: 'Reference copied',
    copyFailedAnnouncement: 'Copy failed. Select and copy the reference manually, or retry.',
    accuracy:
      "AI answers are generated by Claude from Erik's public content and can be wrong. Check anything that matters.",
    privacy:
      'Questions are stored 90 days for product improvement. FORGET under an answer deletes it, or email',
    email: EMAIL_ADDRESS,
    emailHref: `mailto:${EMAIL_ADDRESS}`,
    technicalPrivacy: 'If you are technical, you can also POST your request ID (in the',
    requestIdHeader: 'X-Request-Id',
    technicalPrivacySuffix: 'response header) directly to',
    forgetEndpoint: '/api/log/forget',
  },
  [SITE_LOCALE.pt]: {
    welcome:
      'Conectado. Digite help para listar os comandos, ou pergunte qualquer coisa sobre o Erik.',
    mobileWelcome: 'bem-vindo. digite help ou preencha o prompt a partir de um chip.',
    inputLabel: 'comando do shell',
    outputLabel: 'saída do shell',
    toolbarLabel: 'Atalhos do shell',
    prompt: 'erik@portfolio:~$',
    placeholder: 'digite um comando ou pergunte sobre o Erik…',
    suggestions: [
      ShellCommand.Help,
      ShellCommand.WhoIs,
      ShellCommand.Skills,
      ShellCommand.Now,
      'quais são seus projetos mais fortes?',
      'o que você constrói com agentes e LLMs?',
    ],
    commands: [
      ShellCommand.Help,
      ShellCommand.WhoIs,
      ShellCommand.Skills,
      ShellCommand.Now,
      ShellCommand.Contact,
      ShellCommand.Privacy,
      ShellCommand.Clear,
    ],
    commandHint: 'qualquer outra coisa → Claude',
    aiLabel: '[AI] Claude',
    thinking: 'pensando...',
    stop: '[PARAR]',
    stopLabel: 'Parar resposta',
    stoppedBefore: 'parado antes de uma resposta. Nenhuma resposta foi recebida.',
    stoppedPartial: 'parado. A resposta acima está incompleta.',
    started: 'resposta iniciada',
    complete: 'resposta completa',
    commandComplete: 'Comando completo',
    cleared: 'log limpo',
    busy: 'Uma resposta está em andamento. Pare-a antes de enviar outro comando. Seu rascunho fica guardado.',
    empty: '(resposta vazia)',
    errorPrefix: 'erro:',
    serverError: 'O servidor não conseguiu responder. Tente de novo em um minuto.',
    requestTooLarge: 'Essa pergunta é longa demais. Encurte e tente de novo.',
    answerWithheld:
      'A resposta foi interrompida por uma checagem de segurança. Reformule a pergunta.',
    bodyUnavailable: 'corpo da resposta indisponível',
    offline:
      'offline: reconecte para perguntar ao Claude. Os comandos internos continuam funcionando.',
    networkError:
      'Falha de conexão. Reconecte e tente de novo. Os comandos internos continuam funcionando.',
    localAvailable: 'Os comandos internos continuam funcionando.',
    referencePrefix: 'ref',
    trailerPrefix: '-- req=',
    forgetting: 'EXCLUINDO...',
    forgetDeleted: '✓ pronto, nenhum registro mantido com este id',
    forgetFailed: '! não foi possível excluir, tente de novo',
    forgetRateLimited: '! exclusões demais, tente de novo em {left}',
    privacyEmpty: 'esta sessão não registrou nenhuma requisição.',
    privacyHeader: 'requisições registradas nesta sessão: {count}',
    privacyUsage: 'uso: privacy | privacy forget <número|id> | privacy forget --all',
    privacyUnknown: '! nenhuma requisição {target} nesta sessão.',
    privacyNotAttempted: '{count} não tentadas, rode de novo depois da espera.',
    copy: 'COPIAR',
    forget: 'EXCLUIR',
    copied: 'COPIADO',
    copyFailed: 'FALHA AO COPIAR',
    copiedAnnouncement: 'Referência copiada',
    copyFailedAnnouncement:
      'Falha ao copiar. Selecione e copie a referência manualmente, ou tente de novo.',
    accuracy:
      'As respostas de IA são geradas pelo Claude a partir do conteúdo público do Erik e podem estar erradas. Confira o que for importante.',
    privacy:
      'As perguntas ficam armazenadas por 90 dias para melhoria do produto. EXCLUIR sob uma resposta apaga, ou envie email para',
    email: EMAIL_ADDRESS,
    emailHref: `mailto:${EMAIL_ADDRESS}`,
    technicalPrivacy: 'Se você é técnico, pode também enviar seu request ID (no header',
    requestIdHeader: 'X-Request-Id',
    technicalPrivacySuffix: 'da resposta) diretamente para',
    forgetEndpoint: '/api/log/forget',
  },
};
