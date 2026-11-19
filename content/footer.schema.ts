import { z } from 'zod';

const FooterHrefSchema = z.string().regex(/^(?:#[\w-]+|\/(?!\/)[\w/-]*|https:\/\/[^\s]+)$/);
const FooterLinkSchema = z.object({ label: z.string().min(1), href: FooterHrefSchema });

export const CopyFeedbackSchema = z.object({ label: z.string().min(1), message: z.string() });
export type CopyFeedback = z.infer<typeof CopyFeedbackSchema>;
export type CopyFeedbackState = 'idle' | 'success' | 'failure' | 'unavailable';

export const FooterContentSchema = z
  .object({
    shutdownTitle: z.string().min(1),
    prompt: z.string().min(1),
    shutdownCommand: z.string().min(1),
    sessionTitle: z.string().min(1),
    sessionLabels: z.object({
      user: z.string().min(1),
      uptime: z.string().min(1),
      depth: z.string().min(1),
      seen: z.string().min(1),
      commands: z.string().min(1),
    }),
    user: z.string().min(1),
    netstatTitle: z.string().min(1),
    externalGlyph: z.string().min(1),
    connectionLabels: z.object({
      protocol: z.string().min(1),
      state: z.string().min(1),
      endpoint: z.string().min(1),
    }),
    connections: z
      .array(
        FooterLinkSchema.extend({
          protocol: z.literal('tcp'),
          state: z.enum(['ESTABLISHED', 'LISTEN']),
          external: z.boolean(),
        }),
      )
      .min(1),
    treeTitle: z.string().min(1),
    treeLabel: z.string().min(1),
    fileCount: z.object({ one: z.string().min(1), other: z.string().min(1) }),
    treeOpenDirectory: z.string().min(1),
    groups: z
      .array(
        z.object({
          directory: z.string().regex(/^\.\/[a-z_]+\/$/),
          links: z.array(FooterLinkSchema).min(1),
        }),
      )
      .length(6),
    halted: z.string().min(1),
    haltedAt: z.string().min(1),
    reboot: z.object({
      label: z.string().min(1),
      before: z.string().min(1),
      key: z.string().length(1),
      after: z.string().min(1),
      touch: z.string().min(1),
      announcement: z.string().min(1),
    }),
    receipt: z.object({
      label: z.string().min(1),
    }),
    copyright: z.string().min(1),
  })
  .refine((footer) => footer.groups.some((group) => group.directory === footer.treeOpenDirectory), {
    message: 'treeOpenDirectory must name one of the site map groups',
    path: ['treeOpenDirectory'],
  });
export type FooterContent = z.infer<typeof FooterContentSchema>;
