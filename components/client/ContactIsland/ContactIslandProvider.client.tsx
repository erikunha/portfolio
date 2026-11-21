'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import { createMessageStore, type MessageStore, messageStore } from '../ContactForm/messageStore';

const MessageStoreContext = createContext<MessageStore>(messageStore);

export function ContactIslandProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createMessageStore);
  return <MessageStoreContext value={store}>{children}</MessageStoreContext>;
}

export function useMessageStore(): MessageStore {
  return useContext(MessageStoreContext);
}
