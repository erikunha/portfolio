import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'ask-conversation';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const CONTACT = '5c2e1d0f-3b4a-4c5d-8e6f-7a8b9c0d1e2f';

async function load() {
  vi.resetModules();
  const conversation = await import('./ask-conversation.client');
  const refs = await import('./request-refs.client');
  return { conversation, refs };
}

function forgetAnswers(status: number) {
  const fetchMock = vi.fn(async () => new Response('{}', { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('the per-tab ask conversation', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes nothing until the first question, then mints one random uuid and keeps it', async () => {
    const { conversation } = await load();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    const first = conversation.conversationIdForAsk();
    expect(first).toMatch(UUID);
    expect(conversation.conversationIdForAsk()).toBe(first);
  });

  it('survives a reload of the module in the same tab', async () => {
    const before = (await load()).conversation.conversationIdForAsk();
    const { conversation } = await load();
    expect(conversation.conversationIdForAsk()).toBe(before);
  });

  it('replaces a tampered stored value with a fresh conversation', async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'ask:conv:*', questions: -3, requestIds: [42] }),
    );
    const { conversation } = await load();
    expect(conversation.conversationQuestions()).toBe(0);
    expect(conversation.conversationIdForAsk()).toMatch(UUID);
  });

  it('counts each logged answer and remembers its request id', async () => {
    const { conversation } = await load();
    const id = conversation.conversationIdForAsk() ?? '';
    conversation.recordConversationRequest(id, A);
    conversation.recordConversationRequest(id, B);
    expect(conversation.conversationQuestions()).toBe(2);
    expect(conversation.inConversation(A)).toBe(true);
    expect(conversation.inConversation(CONTACT)).toBe(false);
  });

  it('ignores an answer sent under a conversation that has since ended', async () => {
    const { conversation } = await load();
    const old = conversation.conversationIdForAsk() ?? '';
    conversation.endConversation();
    conversation.recordConversationRequest(old, A);
    expect(conversation.conversationQuestions()).toBe(0);
    expect(conversation.inConversation(A)).toBe(false);
  });

  it('forgetting any id of the conversation drops all of its refs and starts a new conversation', async () => {
    const { conversation, refs } = await load();
    const fetchMock = forgetAnswers(200);
    const old = conversation.conversationIdForAsk() ?? '';
    for (const id of [A, B]) {
      refs.addRef(id);
      conversation.recordConversationRequest(old, id);
    }
    refs.addRef(CONTACT);

    const outcome = await conversation.forgetWithConversation(A);

    expect(outcome.endedConversation).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(refs.listRefs()).toEqual([CONTACT]);
    expect(conversation.conversationQuestions()).toBe(0);
    const next = conversation.conversationIdForAsk();
    expect(next).toMatch(UUID);
    expect(next).not.toBe(old);
  });

  it('keeps the conversation when the forget fails', async () => {
    const { conversation, refs } = await load();
    forgetAnswers(503);
    const id = conversation.conversationIdForAsk() ?? '';
    refs.addRef(A);
    conversation.recordConversationRequest(id, A);

    const outcome = await conversation.forgetWithConversation(A);

    expect(outcome.endedConversation).toBe(false);
    expect(conversation.conversationIdForAsk()).toBe(id);
    expect(refs.listRefs()).toEqual([A]);
  });

  it('forgetting an id outside the conversation leaves the conversation running', async () => {
    const { conversation, refs } = await load();
    forgetAnswers(200);
    const id = conversation.conversationIdForAsk() ?? '';
    conversation.recordConversationRequest(id, A);
    refs.addRef(A);
    refs.addRef(CONTACT);

    const outcome = await conversation.forgetWithConversation(CONTACT);

    expect(outcome.endedConversation).toBe(false);
    expect(conversation.conversationIdForAsk()).toBe(id);
    expect(refs.listRefs()).toEqual([A]);
  });

  it('keeps working in memory when session storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { conversation } = await load();
    const id = conversation.conversationIdForAsk() ?? '';
    expect(id).toMatch(UUID);
    conversation.recordConversationRequest(id, A);
    expect(conversation.conversationQuestions()).toBe(1);
  });
});

describe('the conversation id outside a secure context', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('still mints a random v4 uuid when crypto.randomUUID is missing, so the questions stay linked', async () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new TypeError('crypto.randomUUID is not a function');
    });
    const { conversation } = await load();
    const id = conversation.conversationIdForAsk() ?? '';
    expect(id).toMatch(UUID);
    conversation.recordConversationRequest(id, A);
    conversation.recordConversationRequest(id, B);
    expect(conversation.conversationQuestions()).toBe(2);
  });
});
