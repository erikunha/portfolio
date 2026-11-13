'use client';

import { useSyncExternalStore } from 'react';
import { SESSION_REF_CAP } from '@/lib/forget-limits';
import { type ForgetResult, forgetRequest, wasForgotten } from '@/lib/forget-request.client';
import { removeRef } from '@/lib/request-refs.client';

const STORAGE_KEY = 'ask-conversation';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_REF_LENGTH = 128;

type Conversation = { id: string; questions: number; requestIds: readonly string[] };

const listeners = new Set<() => void>();
let loaded = false;
let conversation: Conversation | null = null;

function isRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_REF_LENGTH;
}

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
const UUID_GROUPS = [8, 4, 4, 4, 12] as const;

function uuidFromRandomBytes(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES));
  bytes[VERSION_BYTE] = ((bytes[VERSION_BYTE] ?? 0) & VERSION_MASK) | VERSION_FOUR;
  bytes[VARIANT_BYTE] = ((bytes[VARIANT_BYTE] ?? 0) & VARIANT_MASK) | VARIANT_RFC;
  const hex = Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'));
  const text = hex.join('');
  let offset = 0;
  return UUID_GROUPS.map((length) => {
    const group = text.slice(offset, offset + length);
    offset += length;
    return group;
  }).join('-');
}

function mint(): string | null {
  try {
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidFromRandomBytes();
  } catch {
    try {
      return uuidFromRandomBytes();
    } catch {
      return null;
    }
  }
}

export function conversationIdForAsk(): string | null {
  const existing = current();
  if (existing) return existing.id;
  const id = mint();
  if (id !== null) write({ id, questions: 0, requestIds: [] });
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

export async function forgetWithConversation(
  requestId: string,
): Promise<{ result: ForgetResult; endedConversation: boolean }> {
  const member = inConversation(requestId);
  const result = await forgetRequest(requestId);
  const endedConversation = member && wasForgotten(result);
  if (endedConversation) endConversation();
  return { result, endedConversation };
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
