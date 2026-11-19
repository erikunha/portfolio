import { z } from 'zod';
import { NOT_FOUND_PATH_TOKEN } from './errors.constants';

const NotFoundTemplateSchema = z
  .string()
  .min(1)
  .refine((value) => value.includes(NOT_FOUND_PATH_TOKEN));

const ErrorHrefSchema = z.string().regex(/^\/(?!\/)[\w/#-]*$/);
const ErrorLinkSchema = z.object({ label: z.string().min(1), href: ErrorHrefSchema });

export const ErrorsContentSchema = z.object({
  notFound: z.object({
    metaTitle: z.string().min(1),
    code: z.literal('404'),
    panelHeader: z.string().min(1),
    prompt: z.string().min(1),
    command: NotFoundTemplateSchema,
    output: NotFoundTemplateSchema,
    pathFallback: z.string().min(1),
    suggestionsLabel: z.string().min(1),
    suggestionsNavLabel: z.string().min(1),
    suggestions: z.array(ErrorLinkSchema).min(1),
    home: ErrorLinkSchema,
  }),
  serverError: z.object({
    code: z.literal('500'),
    message: z.string().min(1),
    bootRender: z.string().min(1),
    bootReport: z.string().min(1),
    retryLabel: z.string().min(1),
    home: ErrorLinkSchema,
    refLabel: z.string().min(1),
    copyLabel: z.string().min(1),
    copyAriaLabel: z.string().min(1),
    copiedAnnouncement: z.string().min(1),
  }),
  noscript: z.object({ text: z.string().min(1), contact: ErrorLinkSchema }),
  componentUnavailable: z.string().min(1),
  componentExplanation: z.string().min(1),
  reloadLabel: z.string().min(1),
});
export type ErrorsContent = z.infer<typeof ErrorsContentSchema>;
export const ErrorsClientContentSchema = ErrorsContentSchema.pick({
  serverError: true,
  componentUnavailable: true,
  componentExplanation: true,
  reloadLabel: true,
});
export type ErrorsClientContent = z.infer<typeof ErrorsClientContentSchema>;
