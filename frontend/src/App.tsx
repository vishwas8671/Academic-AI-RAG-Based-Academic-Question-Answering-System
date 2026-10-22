import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  GraduationCap,
  Sparkles,
  ArrowRight
} from 'lucide-react';

import type {
  DocumentItem,
  SessionItem,
  Message,
  Citation,
  HealthData
} from './types';
import { api } from './services/api';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { ChatMessage } from './components/ChatMessage';
import { SourcePanel } from './components/SourcePanel';
import { SettingsModal } from './components/SettingsModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';

const SUGGESTED_QUESTIONS = [
  'Summarize the core theoretical principles in these course materials.',
  'Explain the primary mechanism step-by-step with relevant equations or examples.',
  'What are the key exam-style questions that can be formulated from this syllabus/notes?',
  'What limitations, assumptions, or future work are highlighted in the conclusion?'
];

export function App() {
  // Navigation & Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ id: string; name?: string; page?: number } | null>(null);

  // Core Data
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSources, setActiveSources] = useState<Citation[]>([]);
  const [selectedCitationId, setSelectedCitationId] = useState<number | null>(null);

  // Controls & States
  const [responseMode, setResponseMode] = useState<'concise' | 'detailed' | 'exam'>('detailed');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial load
  useEffect(() => {
    refreshAllData();
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const refreshAllData = async () => {
    try {
      const [docsData, sessData, healthData] = await Promise.all([
        api.getDocuments(),
        api.getSessions(),
        api.getHealth(),
      ]);
      setDocuments(docsData.documents);
      setSessions(sessData);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsSidebarOpen(false);
    try {
      const detail = await api.getSession(sessionId);
      setMessages(detail.messages);
      // Collect sources from the most recent assistant message
      const lastAsst = [...detail.messages].reverse().find((m) => m.role === 'assistant');
      if (lastAsst && lastAsst.sources) {
        setActiveSources(lastAsst.sources);
      } else {
        setActiveSources([]);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setActiveSources([]);
    setSelectedCitationId(null);
    setIsSidebarOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleToggleDocSelect = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document and all its indexed vector chunks?')) return;
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      api.getHealth().then(setHealth).catch(console.error);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    setInputMessage('');

    // Optimistically add user message to list
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: query,
      mode: responseMode,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const response = await api.sendMessage({
        sessionId: activeSessionId || undefined,
        message: query,
        documentIds: selectedDocIds,
        mode: responseMode,
      });

      // Update active session ID if this was a new session
      if (!activeSessionId) {
        setActiveSessionId(response.session_id);
      }

      const assistantMsg: Message = {
        id: response.message_id,
        session_id: response.session_id,
        role: 'assistant',
        content: response.content,
        sources: response.sources,
        mode: response.mode as any,
        is_refusal: response.is_refusal,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setActiveSources(response.sources || []);

      // If sources were retrieved, ensure the source panel is visible
      if (response.sources && response.sources.length > 0) {
        setIsSourcePanelOpen(true);
      }

      // Refresh session list to show new or updated title
      api.getSessions().then(setSessions).catch(console.error);
      api.getHealth().then(setHealth).catch(console.error);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `**Error**: ${err.message || 'Failed to generate answer. Please check settings or server status.'}`,
        is_refusal: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    // Find last user message
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      handleSendMessage(lastUser.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectCitation = (citationId: number) => {
    setIsSourcePanelOpen(true);
    setSelectedCitationId(citationId);
  };

  const handleInspectDocument = (documentId: string, pageNumber: number) => {
    const doc = documents.find((d) => d.id === documentId);
    setViewerDoc({
      id: documentId,
      name: doc?.filename,
      page: pageNumber,
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F7FA] text-[#172B4D]">
      {/* 1. Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleDocSelect={handleToggleDocSelect}
        onDeleteDoc={handleDeleteDoc}
        health={health}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Main Workspace */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Header */}
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          documents={documents}
          selectedDocIds={selectedDocIds}
          onClearFilter={() => setSelectedDocIds([])}
          responseMode={responseMode}
          onChangeMode={setResponseMode}
          isSourcePanelOpen={isSourcePanelOpen}
          onToggleSourcePanel={() => setIsSourcePanelOpen(!isSourcePanelOpen)}
          sourceCount={activeSources.length}
          onClearChat={handleNewChat}
        />

        {/* Message Viewport */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-3xl mx-auto w-full">
            {/* Empty State when no messages */}
            {messages.length === 0 ? (
              <div className="py-6 sm:py-10 space-y-8 animate-fade-in">
                {/* Academic Welcome Hero */}
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#17324D] text-white shadow-sm mb-2">
                    <GraduationCap className="w-6 h-6 text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#17324D]">
                    Welcome to Academic AI
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Upload course syllabi, lecture notes, textbook chapters, and past exams.
                    Ask questions grounded strictly in your documents with page-level citations.
                  </p>
                </div>

                {/* Upload Dropzone */}
                <div className="max-w-xl mx-auto">
                  <Dropzone
                    onUploadSuccess={(doc) => {
                      setDocuments((prev) => [doc, ...prev]);
                      api.getHealth().then(setHealth).catch(console.error);
                    }}
                  />
                </div>

                {/* Suggested Academic Questions */}
                <div className="max-w-2xl mx-auto">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
                    Suggested Inquiries
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(q)}
                        className="p-3 text-left bg-white border border-[#E2E8F0] hover:border-[#0F766E]/60 hover:bg-slate-50/80 rounded-xl text-xs text-slate-700 transition-all flex items-start justify-between group shadow-2xs"
                      >
                        <span className="leading-relaxed group-hover:text-[#17324D] font-medium">{q}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F766E] shrink-0 mt-0.5 ml-2 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Active Chat History */
              <div className="space-y-2 pb-4">
                {messages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id || idx}
                    message={msg}
                    onSelectCitation={handleSelectCitation}
                    onRegenerate={handleRegenerate}
                    isLastAssistant={idx === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))}

                {isLoading && (
                  <div className="flex gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-[#102438] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0F766E]" />
                      <span className="text-xs text-slate-600 font-medium">
                        Retrieving passages from ChromaDB & synthesizing grounded answer...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#E2E8F0] shrink-0 shadow-xs">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            {/* Inline PDF dropzone trigger */}
            <Dropzone
              isCompact
              onUploadSuccess={(doc) => {
                setDocuments((prev) => [doc, ...prev]);
                api.getHealth().then(setHealth).catch(console.error);
              }}
            />

            {/* Input textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  documents.length === 0
                    ? 'Upload a course PDF first, or type a query...'
                    : selectedDocIds.length > 0
                    ? `Ask about selected document (${documents.find(d => d.id === selectedDocIds[0])?.filename})...`
                    : 'Ask an academic question about your course materials (Press Enter)...'
                }
                rows={1}
                className="w-full resize-none px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0] focus:border-[#0F766E] focus:outline-none bg-[#F5F7FA] text-[#172B4D] placeholder-slate-400 max-h-32 leading-relaxed"
                style={{ minHeight: '44px' }}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="p-2.5 sm:px-4 sm:py-2.5 bg-[#17324D] hover:bg-[#102438] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">Ask AI</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* 3. Source Citations Panel (Collapsible) */}
      <SourcePanel
        sources={activeSources}
        isOpen={isSourcePanelOpen}
        onClose={() => setIsSourcePanelOpen(false)}
        selectedCitationId={selectedCitationId}
        onInspectDocument={handleInspectDocument}
      />

      {/* 4. Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={refreshAllData}
      />

      <DocumentViewerModal
        isOpen={viewerDoc !== null}
        onClose={() => setViewerDoc(null)}
        documentId={viewerDoc?.id || null}
        documentName={viewerDoc?.name}
        initialPage={viewerDoc?.page}
      />
    </div>
  );
}

export default App;
