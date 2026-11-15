import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return import('./conversation.client');
}

describe('useConversationQuestions subscription', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('re-renders the consumer when a question is recorded and when the conversation ends', async () => {
    const {
      conversationIdForAsk,
      recordConversationRequest,
      endConversation,
      useConversationQuestions,
    } = await load();
    function Count() {
      return <output>{useConversationQuestions()}</output>;
    }
    render(<Count />);
    expect(screen.getByRole('status').textContent).toBe('0');

    let id = '';
    act(() => {
      id = conversationIdForAsk();
    });
    expect(screen.getByRole('status').textContent).toBe('0');

    act(() => recordConversationRequest(id, 'req-1'));
    expect(screen.getByRole('status').textContent).toBe('1');

    act(() => recordConversationRequest(id, 'req-2'));
    expect(screen.getByRole('status').textContent).toBe('2');

    act(() => endConversation());
    expect(screen.getByRole('status').textContent).toBe('0');
  });
});
