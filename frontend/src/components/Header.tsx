import React from 'react';
import {
  Menu,
  BookOpen,
  Sparkles,
  RotateCcw,
  BookMarked
} from 'lucide-react';
import type { DocumentItem } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  documents: DocumentItem[];
  selectedDocIds: string[];
  onClearFilter: () => void;
  responseMode: 'concise' | 'detailed' | 'exam';
  onChangeMode: (mode: 'concise' | 'detailed' | 'exam') => void;
  isSourcePanelOpen: boolean;
  onToggleSourcePanel: () => void;
  sourceCount: number;
  onClearChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  documents,
  selectedDocIds,
  onClearFilter,
  responseMode,
  onChangeMode,
  isSourcePanelOpen,
  onToggleSourcePanel,
  sourceCount,
  onClearChat,
}) => {
  const isFiltered = selectedDocIds.length > 0;
  const filteredDocNames = documents
    .filter((d) => selectedDocIds.includes(d.id))
    .map((d) => d.filename);

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] px-4 flex items-center justify-between shrink-0 shadow-xs z-10">
      {/* Left section: Hamburger & Collection status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#17324D] bg-[#F5F7FA] px-2.5 py-1 rounded-md border border-[#E2E8F0]">
            <BookOpen className="w-3.5 h-3.5 text-[#0F766E]" />
            <span>
              {isFiltered
                ? `Filtered: ${filteredDocNames[0]}${filteredDocNames.length > 1 ? ` +${filteredDocNames.length - 1}` : ''}`
                : `All Documents (${documents.length})`}
            </span>
            {isFiltered && (
              <button
                onClick={onClearFilter}
                className="ml-1 text-[11px] text-slate-400 hover:text-slate-700 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center/Right section: Mode selector, Clear chat, Source Panel button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Response Mode Selector */}
        <div className="hidden sm:flex items-center bg-[#F5F7FA] p-0.5 rounded-lg border border-[#E2E8F0] text-xs">
          <button
            onClick={() => onChangeMode('concise')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              responseMode === 'concise'
                ? 'bg-white text-[#17324D] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Concise
          </button>
          <button
            onClick={() => onChangeMode('detailed')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              responseMode === 'detailed'
                ? 'bg-white text-[#17324D] shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Detailed
          </button>
          <button
            onClick={() => onChangeMode('exam')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              responseMode === 'exam'
                ? 'bg-white text-[#0F766E] shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#0F766E]" />
            Exam Prep
          </button>
        </div>

        {/* Clear Chat */}
        <button
          onClick={onClearChat}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          title="Clear Conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Sources Toggle */}
        <button
          onClick={onToggleSourcePanel}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
            isSourcePanelOpen
              ? 'bg-[#17324D] text-white border-[#17324D]'
              : 'bg-white text-slate-700 border-[#E2E8F0] hover:bg-slate-50'
          }`}
          title="Toggle Source Citations Panel"
        >
          <BookMarked className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden sm:inline">Sources</span>
          {sourceCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isSourcePanelOpen ? 'bg-teal-700 text-white' : 'bg-teal-100 text-[#0F766E]'
              }`}
            >
              {sourceCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
