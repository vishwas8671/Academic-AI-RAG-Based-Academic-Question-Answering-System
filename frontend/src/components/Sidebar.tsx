import React from 'react';
import {
  GraduationCap,
  Plus,
  MessageSquare,
  FileText,
  Trash2,
  Settings,
  X,
  FileCheck
} from 'lucide-react';
import type { DocumentItem, SessionItem, HealthData } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  documents: DocumentItem[];
  selectedDocIds: string[];
  onToggleDocSelect: (id: string) => void;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
  health: HealthData | null;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  documents,
  selectedDocIds,
  onToggleDocSelect,
  onDeleteDoc,
  health,
  onOpenSettings,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#102438] text-white flex flex-col border-r border-[#17324D] transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header / Brand */}
        <div className="p-4 flex items-center justify-between border-b border-[#17324D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0F766E] flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white leading-tight">Academic AI</h1>
              <p className="text-[11px] text-slate-400 font-medium">Grounded Research Assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F766E] hover:bg-[#115e59] text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Discussion</span>
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Chat History */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                Chat History
              </span>
              <span className="text-[10px] text-slate-500 font-mono bg-[#17324D] px-1.5 py-0.5 rounded">
                {sessions.length}
              </span>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-2 italic">No past sessions</p>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#17324D] text-teal-300 font-medium border-l-2 border-[#0F766E]'
                          : 'text-slate-300 hover:bg-[#17324D]/60 hover:text-white'
                      }`}
                    >
                      <div className="truncate flex-1 mr-2" title={session.title}>
                        {session.title || 'Academic Query'}
                      </div>
                      <button
                        onClick={(e) => onDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ingested Documents List */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Course Documents
              </span>
              <span className="text-[10px] text-slate-500 font-mono bg-[#17324D] px-1.5 py-0.5 rounded">
                {documents.length}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-2 bg-[#17324D]/30 rounded border border-dashed border-[#17324D] text-center">
                Upload PDFs to begin
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => {
                  const isFiltered = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={`group flex items-center justify-between p-2 rounded border text-xs transition-colors ${
                        isFiltered
                          ? 'bg-[#17324D] border-[#0F766E] text-white'
                          : 'bg-[#17324D]/40 border-transparent text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                        onClick={() => onToggleDocSelect(doc.id)}
                        title={`Click to filter. ${doc.page_count} pages, ${doc.chunk_count} passages`}
                      >
                        <FileCheck className={`w-4 h-4 shrink-0 ${isFiltered ? 'text-teal-400' : 'text-slate-400'}`} />
                        <div className="truncate">
                          <p className="truncate font-medium text-slate-200">{doc.filename}</p>
                          <p className="text-[10px] text-slate-400">
                            {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'} • {doc.chunk_count} chunks
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => onDeleteDoc(doc.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity ml-1"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer / System Health & Settings */}
        <div className="p-3 border-t border-[#17324D] bg-[#0c1c2e] text-xs space-y-2">
          {/* Health Status */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] text-slate-400">
                {health?.active_provider ? health.active_provider.toUpperCase() : 'ONLINE'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {health?.total_chunks || 0} vectors
            </div>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-between py-2 px-3 rounded bg-[#17324D]/70 hover:bg-[#17324D] text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-teal-400" />
              <span>Settings & Models</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Config</span>
          </button>
        </div>
      </aside>
    </>
  );
};
