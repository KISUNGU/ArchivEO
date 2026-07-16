import React, { createContext, useContext, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children, onOpenDocument }) {
  const [isOpen, setIsOpen] = useState(false);
  const [document, setDocument] = useState(null);

  const openChat = (doc = null) => {
    setDocument(doc);
    setIsOpen(true);
  };
  const closeChat = () => setIsOpen(false);

  // Ouvre un document dans les Archives (fourni par Accueil)
  const openDocument = (docId) => onOpenDocument?.(docId);

  return (
    <ChatContext.Provider value={{ isOpen, document, openChat, closeChat, openDocument }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat doit être utilisé à l\'intérieur de ChatProvider');
  return ctx;
}
