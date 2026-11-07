'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'request-refs';
const MAX_REF_LENGTH = 128;

export const REQUEST_REF_LIMITS = { maxRefs: 20 } as const;

const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();
let refs: readonly string[] | null = null;

function isRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_REF_LENGTH;
}

function readStored(): readonly string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRef).slice(-REQUEST_REF_LIMITS.maxRefs) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function current(): readonly string[] {
  if (typeof window === 'undefined') return EMPTY;
  refs ??= readStored();
  return refs;
}

function persist(next: readonly string[]): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function write(next: readonly string[]): void {
  refs = next;
  persist(next);
  for (const listener of listeners) listener();
}

export function listRefs(): readonly string[] {
  return current();
}

export function lastRef(): string | null {
  return current().at(-1) ?? null;
}

export function addRef(ref: string): void {
  if (!isRef(ref)) return;
  write(
    [...current().filter((existing) => existing !== ref), ref].slice(-REQUEST_REF_LIMITS.maxRefs),
  );
}

export function removeRef(ref: string): void {
  const kept = current().filter((existing) => existing !== ref);
  if (kept.length !== current().length) write(kept);
}

export function clearRefs(): void {
  if (current().length > 0) write(EMPTY);
}

export function subscribeRefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLastRef(): string | null {
  return useSyncExternalStore(subscribeRefs, lastRef, () => null);
}
