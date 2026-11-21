import { z } from 'zod';

const MIN_SECTION_TEXT_LENGTH = 1;

export const CompanyUrlSchema = z.url({ protocol: /^https$/ });

export const LocalizedTextSchema = z.object({
  pt: z.string().min(1),
  en: z.string().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const SectionTextSchema = z
  .string()
  .min(MIN_SECTION_TEXT_LENGTH)
  .refine((text) => text === text.trim(), {
    message: 'Section text must not have leading or trailing whitespace',
  });
