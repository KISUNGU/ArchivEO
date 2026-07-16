import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, Sparkles, Loader2, FileText, History,
  Plus, Trash2, Paperclip, ArrowLeft, Image as ImageIcon, Copy, Check,
  Search, BookOpen, Archive, Zap, Mic, Menu, Settings,
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import {
  listConversations, createConversation, deleteConversation,
  listMessages, addMessage,
} from '../services/chatService';
import { chatWithDocument } from '../services/aiAgentService';
import { getDocument } from '../services/documentsService';
import { extractPdfText, renderPdfFirstPage } from '../services/pdfTextExtractor';

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png']);

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const DOC_LINK_REGEX = /\[\[doc:([0-9a-fA-F-]{36})\|([^\]]+)\]\]/g;

// Renders inline markdown with improved styling
function renderInline(text, key) {
  const parts = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0, i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(<span key={`t${key}-${i++}`}>{text.slice(last, m.index)}</span>);
    if (m[2] !== undefined) parts.push(
      <strong key={`b${key}-${i++}`} className="font-semibold text-slate-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
        {m[2]}
      </strong>
    );
    else if (m[3] !== undefined) parts.push(
      <em key={`e${key}-${i++}`} className="italic text-slate-600 dark:text-slate-300">{m[3]}</em>
    );
    else if (m[4] !== undefined) parts.push(
      <code key={`c${key}-${i++}`} className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-md px-2 py-0.5 font-mono text-[0.9em] text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-slate-600">
        {m[4]}
      </code>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={`t${key}-${i++}`}>{text.slice(last)}</span>);
  return parts.length ? parts : [text];
}

function renderInlineWithDocLinks(text, key, onOpenDoc) {
  const parts = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(DOC_LINK_REGEX)) {
    if (m.index > last) {
      parts.push(<React.Fragment key={`f-${key}-${i++}`}>{renderInline(text.slice(last, m.index), `${key}-${i}`)}</React.Fragment>);
    }
    const [, docId, docName] = m;
    parts.push(
      <button
        key={`doclink-${key}-${i++}`}
        onClick={() => onOpenDoc(docId)}
        className="inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-300 hover:from-blue-500/30 hover:to-indigo-500/30 hover:text-blue-700 dark:hover:text-blue-200 text-[0.95em] font-medium transition-all duration-200 border border-blue-200/50 dark:border-blue-500/30 shadow-sm hover:shadow"
        title="Ouvrir ce document dans les Archives"
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        {docName}
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<React.Fragment key={`f-${key}-${i++}`}>{renderInline(text.slice(last), `${key}-tail`)}</React.Fragment>);
  }
  return parts.length ? parts : [text];
}

// Enhanced markdown renderer with better visual hierarchy
function renderMessageContent(content, onOpenDoc) {
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  const segments = [];
  let last = 0, segKey = 0;

  for (const m of content.matchAll(codeBlockRe)) {
    if (m.index > last) segments.push({ type: 'text', value: content.slice(last, m.index), key: segKey++ });
    segments.push({ type: 'code', lang: m[1], value: m[2], key: segKey++ });
    last = m.index + m[0].length;
  }
  if (last < content.length) segments.push({ type: 'text', value: content.slice(last), key: segKey++ });

  const result = [];

  for (const seg of segments) {
    if (seg.type === 'code') {
      result.push(
        <div key={`code-${seg.key}`} className="relative group">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={seg.value} />
          </div>
          <pre className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4 my-2 overflow-auto text-sm font-mono text-slate-700 dark:text-slate-200 whitespace-pre-wrap shadow-inner">
            {seg.value.trimEnd()}
          </pre>
        </div>
      );
      continue;
    }

    const lines = seg.value.split('\n');
    let listItems = [];
    let listType = null;
    let listKey = 0;

    const flushList = () => {
      if (!listItems.length) return;
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      const cls = listType === 'ol' ? 'list-decimal' : 'list-disc';
      result.push(
        <Tag key={`list-${seg.key}-${listKey++}`} className={`${cls} pl-6 my-2 space-y-1`}>
          {listItems.map((li, idx) => (
            <li key={idx} className="text-slate-700 dark:text-slate-200 leading-relaxed">
              {renderInlineWithDocLinks(li, `li-${seg.key}-${idx}`, onOpenDoc)}
            </li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    };

    lines.forEach((line, lineIdx) => {
      const ulMatch = line.match(/^[\s]*[-*•]\s+(.+)/);
      const olMatch = line.match(/^[\s]*\d+\.\s+(.+)/);
      if (ulMatch) {
        if (listType === 'ol') flushList();
        listType = 'ul';
        listItems.push(ulMatch[1]);
      } else if (olMatch) {
        if (listType === 'ul') flushList();
        listType = 'ol';
        listItems.push(olMatch[1]);
      } else {
        flushList();
        if (line.trim() === '') {
          if (lineIdx > 0) result.push(<br key={`br-${seg.key}-${lineIdx}`} />);
        } else {
          result.push(
            <div key={`line-${seg.key}-${lineIdx}`} className="leading-relaxed">
              {renderInlineWithDocLinks(line, `${seg.key}-${lineIdx}`, onOpenDoc)}
            </div>
          );
        }
      }
    });
    flushList();
  }

  return result.length ? result : [content];
}

function formatConvDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatMsgTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const ACTION_META = {
  recherche: { icon: Search, label: 'Recherche effectuée', color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20' },
  lecture: { icon: BookOpen, label: 'Document lu', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  archivage: { icon: Archive, label: 'Document archivé', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

function ActionBadges({ actions }) {
  if (!actions?.length) return null;
  const unique = [...new Set(actions)];
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {unique.map((a) => {
        const meta = ACTION_META[a];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span key={a} className={`inline-flex items-center gap-1.5 text-[0.7rem] px-2.5 py-1 rounded-full border ${meta.color} backdrop-blur-sm`}>
            <Icon className="h-3 w-3" />{meta.label}
          </span>
        );
      })}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shadow-sm hover:shadow"
      title="Copier"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const SUGGESTIONS = [
  { label: '📄 Chercher un document', prompt: 'Cherche tous les documents récents dans les archives.' },
  { label: '🧾 Dernière facture', prompt: 'Trouve la dernière facture archivée.' },
  { label: '📋 Notes de service', prompt: 'Liste les notes de service disponibles.' },
  { label: '📊 Rapport récent', prompt: 'Y a-t-il des rapports récents dans les archives ?' },
];

export default function ChatBot() {
  const { isOpen, document: contextDoc, openChat, closeChat, openDocument } = useChat();

  const [view, setView] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [draftDoc, setDraftDoc] = useState(null);
  const [docContent, setDocContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageActions, setMessageActions] = useState({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const reloadConversations = () =>
    listConversations().then(setConversations).catch(() => {});

  useEffect(() => {
    if (!isOpen) return;
    reloadConversations();
    if (contextDoc) {
      setActiveConv(null);
      setDraftDoc(contextDoc);
      setDocContent(contextDoc.content_text || '');
      setMessages([]);
      setMessageActions({});
      setView('chat');
    }
  }, [isOpen, contextDoc]);

  const openConversation = async (conv) => {
    setView('chat');
    setActiveConv(conv);
    setDraftDoc(null);
    setMessageActions({});
    setLoadingHistory(true);
    try {
      setMessages(await listMessages(conv.id));
      if (conv.document_id) {
        const doc = await getDocument(conv.document_id).catch(() => null);
        setDocContent(doc?.content_text || '');
      } else {
        setDocContent('');
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const newConversation = () => {
    setActiveConv(null);
    setDraftDoc(null);
    setDocContent('');
    setMessages([]);
    setMessageActions({});
    setAttachment(null);
    setView('chat');
  };

  const handleDeleteConv = async (conv, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Supprimer la discussion « ${conv.title} » ?`)) return;
    await deleteConversation(conv.id);
    setConversations(prev => prev.filter(c => c.id !== conv.id));
    if (activeConv?.id === conv.id) newConversation();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, view]);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const sizeKb = Math.round(file.size / 1024);
    setAttachment({ name: file.name, loading: true });
    try {
      if (ext === 'pdf') {
        const { text } = await extractPdfText(file).catch(() => ({ text: '' }));
        if (text) {
          setAttachment({ name: file.name, text, sizeKb });
        } else {
          const dataUrl = await renderPdfFirstPage(file, 1200);
          setAttachment({ name: file.name, imageBase64: dataUrl.split(',')[1], mediaType: 'image/png', sizeKb });
        }
      } else if (IMAGE_EXT.has(ext)) {
        if (file.size > 4.5 * 1024 * 1024) throw new Error('Image trop lourde (max 4,5 Mo)');
        setAttachment({
          name: file.name,
          imageBase64: await fileToBase64(file),
          mediaType: ext === 'png' ? 'image/png' : 'image/jpeg',
          sizeKb,
        });
      } else if (ext === 'txt') {
        setAttachment({ name: file.name, text: await file.text(), sizeKb });
      } else {
        throw new Error('Format non pris en charge (PDF, JPG, PNG, TXT)');
      }
    } catch (err) {
      setAttachment(null);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: `Impossible de joindre « ${file.name} » : ${err.message}`,
        created_at: new Date().toISOString(),
      }]);
    }
  };

  const handleSend = async (overrideInput) => {
    const question = (overrideInput !== undefined ? overrideInput : input).trim();
    if ((!question && !attachment) || sending || attachment?.loading) return;
    setInput('');
    setSending(true);

    const att = attachment;
    setAttachment(null);

    try {
      let conv = activeConv;
      if (!conv) {
        conv = await createConversation({
          title: draftDoc ? draftDoc.name : (question || att?.name || 'Nouvelle discussion'),
          documentId: draftDoc?.id || null,
        });
        setActiveConv(conv);
        reloadConversations();
      }

      const displayContent = att ? `📎 ${att.name}\n${question}`.trim() : question;
      const userMsg = await addMessage({
        conversationId: conv.id,
        documentId: conv.document_id,
        role: 'user',
        content: displayContent,
      });
      setMessages(prev => [...prev, userMsg]);

      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const { answer, actions } = await chatWithDocument({
        documentName: conv.documents?.name || draftDoc?.name || '',
        documentContent: docContent,
        history,
        question,
        attachmentName: att?.name,
        attachedText: att?.text,
        attachmentSizeKb: att?.sizeKb,
        imageBase64: att?.imageBase64,
        imageMediaType: att?.mediaType,
      });

      const assistantMsg = await addMessage({
        conversationId: conv.id,
        documentId: conv.document_id,
        role: 'assistant',
        content: answer,
      });
      setMessages(prev => [...prev, assistantMsg]);
      if (actions?.length) {
        setMessageActions(prev => ({ ...prev, [assistantMsg.id]: actions }));
      }
      reloadConversations();
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: `Erreur lors de la génération de la réponse : ${err.message}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const headerTitle = view === 'history'
    ? 'Historique des discussions'
    : (activeConv?.title || draftDoc?.name || 'Assistant ArchivÉo');

  const hasDocContext = Boolean(activeConv?.document_id || draftDoc);

  const filteredConvs = conversations.filter(c =>
    !historySearch || c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <>
      {/* Bouton flottant amélioré avec effet de brillance */}
      <motion.button
        onClick={() => (isOpen ? closeChat() : openChat(null))}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-2xl flex items-center justify-center text-white hover:shadow-3xl transition-all duration-300 group"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="fixed bottom-24 right-3 sm:right-6 z-40 w-[min(460px,calc(100vw-1.5rem))] h-[min(640px,calc(100vh-8rem))] bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm"
          >
            {/* En-tête modernisé */}
            <div className="flex items-center gap-2 px-4 py-3.5 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10 border-b border-slate-200 dark:border-slate-700">
              {view === 'history' ? (
                <button onClick={() => setView('chat')} className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200" title="Retour">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-sm opacity-50 animate-pulse" />
                  <Sparkles className="h-5 w-5 text-blue-500 relative z-10" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 dark:text-white text-sm font-semibold truncate bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {headerTitle}
                </p>
                {view === 'chat' && hasDocContext && (
                  <p className="text-slate-500 text-[11px] flex items-center gap-1.5 truncate">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <FileText className="h-3 w-3" /> Contexte document actif
                  </p>
                )}
              </div>
              {view === 'chat' && (
                <>
                  <button onClick={() => { reloadConversations(); setHistorySearch(''); setView('history'); }} className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200" title="Historique">
                    <History className="h-4 w-4" />
                  </button>
                  <button onClick={newConversation} className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200" title="Nouvelle discussion">
                    <Plus className="h-4 w-4" />
                  </button>
                  {activeConv && (
                    <button onClick={(e) => handleDeleteConv(activeConv, e)} className="p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200" title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Vue historique améliorée */}
            {view === 'history' && (
              <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-800/50">
                <button
                  onClick={newConversation}
                  className="flex items-center gap-2 justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-4 w-4" /> Nouvelle discussion
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Rechercher une discussion…"
                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                {filteredConvs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <History className="h-12 w-12 mb-2 opacity-20" />
                    <p className="text-sm">{historySearch ? 'Aucun résultat.' : 'Aucune discussion enregistrée.'}</p>
                  </div>
                )}
                {filteredConvs.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`group flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 ${
                      activeConv?.id === conv.id
                        ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-2 border-blue-500/40 shadow-lg'
                        : 'bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md'
                    }`}
                  >
                    {conv.document_id
                      ? <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                      : <MessageCircle className="h-5 w-5 text-slate-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-slate-500 text-xs">{formatConvDate(conv.updated_at)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConv(conv, e)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Vue discussion améliorée */}
            {view === 'chat' && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 flex flex-col gap-4 bg-gradient-to-b from-transparent to-slate-50/30 dark:to-slate-800/30">
                  {loadingHistory && (
                    <div className="flex items-center justify-center py-8 text-slate-500 gap-3 text-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Chargement de la conversation…
                    </div>
                  )}

                  {!loadingHistory && messages.length === 0 && (
                    <div className="flex flex-col gap-4 py-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 mb-3">
                          <Sparkles className="h-8 w-8 text-blue-500" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                          {hasDocContext
                            ? `📄 « ${draftDoc?.name || activeConv?.title} »`
                            : '👋 Bonjour ! Comment puis-je vous aider ?'}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                          {hasDocContext
                            ? 'Posez une question sur ce document archivé.'
                            : 'Posez une question, joignez un fichier, ou choisissez une suggestion :'}
                        </p>
                      </div>
                      {!hasDocContext && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {SUGGESTIONS.map((s) => (
                            <button
                              key={s.label}
                              onClick={() => handleSend(s.prompt)}
                              className="flex items-center gap-2 bg-white dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md"
                            >
                              <span className="text-lg">{s.label.split(' ')[0]}</span>
                              <span className="text-slate-700 dark:text-slate-300 text-xs font-medium flex-1">{s.label.split(' ').slice(1).join(' ')}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {messages.map(m => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex flex-col gap-0.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`group relative max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          m.role === 'user'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                            : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 shadow-slate-200/50 dark:shadow-slate-700/20'
                        }`}
                      >
                        {m.role === 'assistant' ? (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {renderMessageContent(m.content, openDocument)}
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <CopyButton text={m.content} />
                            </div>
                          </>
                        ) : (
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        )}
                      </div>
                      {m.role === 'assistant' && <ActionBadges actions={messageActions[m.id]} />}
                      {m.created_at && (
                        <span className="text-[10px] text-slate-400 px-1.5">{formatMsgTime(m.created_at)}</span>
                      )}
                    </motion.div>
                  ))}

                  {sending && (
                    <div className="self-start flex items-center gap-3 text-slate-400 text-sm px-4 py-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> L'assistant réfléchit…
                    </div>
                  )}
                </div>

                {/* Pièce jointe améliorée */}
                {attachment && (
                  <div className="mx-4 mb-2 flex items-center gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm">
                    {attachment.loading
                      ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 shrink-0" />
                      : attachment.imageBase64
                        ? <ImageIcon className="h-5 w-5 text-blue-400 shrink-0" />
                        : <FileText className="h-5 w-5 text-blue-400 shrink-0" />}
                    <span className="text-slate-600 dark:text-slate-300 text-sm flex-1 truncate font-medium">
                      {attachment.name}{attachment.loading ? ' — lecture…' : ''}
                    </span>
                    <button onClick={() => setAttachment(null)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Zone de saisie améliorée */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <div className="flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.txt"
                      className="hidden"
                      onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={sending}
                      className="w-11 h-11 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 disabled:opacity-40 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white transition-all duration-200"
                      title="Joindre un fichier (PDF, image, texte)"
                    >
                      <Paperclip className="h-4.5 w-4.5" />
                    </button>
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={attachment ? 'Ta question sur ce fichier…' : 'Écris ta question…'}
                      className="flex-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={sending || (!input.trim() && !attachment) || attachment?.loading}
                      className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 flex items-center justify-center text-white transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Send className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}