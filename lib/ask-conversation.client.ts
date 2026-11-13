'use client';

import { useSyncExternalStore } from 'react';
import { SESSION_REF_CAP } from '@/lib/forget-limits';
import { type ForgetResult, forgetRequest, wasForgotten } from '@/lib/forget-request.client';
import { isRef, removeRef } from '@/lib/request-refs.client';

const STORAGE_KEY = 'ask-conversation';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Conversation = { id: string; questions: number; requestIds: readonly string[] };

const listeners = new Set<() => void>();
let loaded = false;
let conversation: Conversation | null = null;
let forgetsHeld = 0;

function parseStored(raw: string | null): Conversation | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return null;
  const { id, questions, requestIds } = value as Record<string, unknown>;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;
  if (!Number.isSafeInteger(questions) || (questions as number) < 0) return null;
  if (!Array.isArray(requestIds) || !requestIds.every(isRef)) return null;
  return { id, questions: questions as number, requestIds: requestIds.slice(-SESSION_REF_CAP) };
}

function current(): Conversation | null {
  if (typeof window === 'undefined') return null;
  if (!loaded) {
    loaded = true;
    try {
      conversation = parseStored(window.sessionStorage.getItem(STORAGE_KEY));
    } catch {
      conversation = null;
    }
  }
  return conversation;
}

function persist(next: Conversation | null): void {
  try {
    if (next === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function write(next: Conversation | null): void {
  conversation = next;
  persist(next);
  for (const listener of listeners) listener();
}

const UUID_BYTES = 16;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;
const VERSION_MASK = 0x0f;
const VERSION_FOUR = 0x40;
const VARIANT_MASK = 0x3f;
const VARIANT_RFC = 0x80;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const UUID_GROUPING = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/;

function mint(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES));
  bytes[VERSION_BYTE] = ((bytes[VERSION_BYTE] ?? 0) & VERSION_MASK) | VERSION_FOUR;
  bytes[VARIANT_BYTE] = ((bytes[VARIANT_BYTE] ?? 0) & VARIANT_MASK) | VARIANT_RFC;
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'))
    .join('')
    .replace(UUID_GROUPING, '$1-$2-$3-$4-$5');
}

export function conversationIdForAsk(): string {
  const existing = current();
  if (existing) return existing.id;
  const id = mint();
  write({ id, questions: 0, requestIds: [] });
  return id;
}

export function recordConversationRequest(sentConversationId: string, requestId: string): void {
  const existing = current();
  if (!existing || existing.id !== sentConversationId || !isRef(requestId)) return;
  write({
    id: existing.id,
    questions: existing.questions + 1,
    requestIds: [...existing.requestIds.filter((id) => id !== requestId), requestId].slice(
      -SESSION_REF_CAP,
    ),
  });
}

export function conversationQuestions(): number {
  return current()?.questions ?? 0;
}

export function latestConversationRequest(): string | null {
  return current()?.requestIds.at(-1) ?? null;
}

export function inConversation(requestId: string): boolean {
  return current()?.requestIds.includes(requestId) ?? false;
}

export function endConversation(): void {
  const existing = current();
  if (!existing) return;
  for (const id of existing.requestIds) removeRef(id);
  write(null);
}

export function holdForget(): () => void {
  forgetsHeld += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    forgetsHeld -= 1;
  };
}

export function forgetInFlight(): boolean {
  return forgetsHeld > 0;
}

export async function forgetWithConversation(
  requestId: string,
): Promise<{ result: ForgetResult; endedConversation: boolean }> {
  const release = holdForget();
  try {
    const member = inConversation(requestId);
    const result = await forgetRequest(requestId);
    const endedConversation = member && wasForgotten(result);
    if (endedConversation) endConversation();
    return { result, endedConversation };
  } finally {
    release();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConversationQuestions(): number {
  return useSyncExternalStore(subscribe, conversationQuestions, () => 0);
}
