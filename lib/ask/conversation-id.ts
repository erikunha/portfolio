import { z } from 'zod';

const ConversationIdSchema = z.uuid().toLowerCase();

export function parseConversationId(value: unknown): string | null {
  const parsed = ConversationIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
