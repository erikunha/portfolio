import { z } from 'zod';

const text = z.string().min(1);

export const ShellStatesSchema = z.object({
  thinkingElapsed: text,
  escStop: text,
  stderrCommand: text,
  timeoutName: text,
  timeoutBody: text,
  retry: text,
  retryLabel: text,
  tryPrefix: text,
  tryCommand: text,
  trySuffix: text,
  slowDown: text,
  minutesUnit: text,
  secondsUnit: text,
  localCommands: text,
  rateLimitReady: text,
  forgetting: text,
  forgetDeleted: text,
  forgetNotFound: text,
  forgetFailed: text,
  forgetRateLimited: text,
  privacyEmpty: text,
  privacyHeader: text,
  privacyHint: text,
  privacyUsage: text,
  privacyUnknown: text,
  privacyNotAttempted: text,
});
export type ShellStates = z.infer<typeof ShellStatesSchema>;

export const OfflineNoticeSchema = z.object({
  badge: text,
  message: text,
});
export type OfflineNotice = z.infer<typeof OfflineNoticeSchema>;
