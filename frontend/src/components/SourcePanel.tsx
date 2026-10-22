import React, { useEffect, useRef } from 'react';
import {
  BookMarked,
  ExternalLink,
  X,
  Sparkles
} from 'lucide-react';
import type { Citation } from '../types';

interface SourcePanelProps {
  sources: Citation[];
  isOpen: boolean;
  onClose: () => void;
  selectedCitationId: number | null;
  onInspectDocument: (documentId: string, pageNumber: number) => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sources,
  isOpen,
  onClose,
  selectedCitationId,
  onInspectDocument,
}) => {
  const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (selectedCitationId && itemRefs.current[selectedCitationId]) {
      itemRefs.current[selectedCitationId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedCitationId]);

  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 bg-white border-l border-[#E2E8F0] flex flex-col h-full shrink-0 shadow-xs z-20">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-[#F5F7FA]">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-[#0F766E]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#17324D]">
            Retrieved Passages
          </h2>
          <span className="text-[11px] font-mono bg-teal-100 text-[#0F766E] px-2 py-0.5 rounded-full font-bold">
            {sources.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60"
          title="Close source panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {sources.length === 0 ? (
          <div className="text-center py-12 px-4">
            <BookMarked className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No Sources Retrieved</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Ask a question about your uploaded course materials to inspect retrieved evidence passages.
            </p>
          </div>
        ) : (
          sources.map((source) => {
            const isSelected = selectedCitationId === source.citation_id;
            const scorePercent = Math.round(source.relevance_score * 100);

            return (
              <div
                key={source.citation_id}
                ref={(el) => {
                  itemRefs.current[source.citation_id] = el;
                }}
                className={`rounded-xl border p-3.5 transition-all ${
                  isSelected
                    ? 'border-[#0F766E] bg-teal-50/40 ring-2 ring-[#0F766E]/20 shadow-xs'
                    : 'border-[#E2E8F0] bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Source Title & Badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-[#17324D] text-white">
                      [{source.citation_id}]
                    </span>
                    <span
                      className="text-xs font-semibold text-[#172B4D] truncate"
                      title={source.document_name}
                    >
                      {source.document_name}
                    </span>
                  </div>

                  <span className="shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Page {source.page_number}
                  </span>
                </div>

                {/* Relevance Score Bar */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#0F766E]" />
                      Relevance match
                    </span>
                    <span className="font-mono font-bold text-slate-700">{scorePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0F766E] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(15, scorePercent))}%` }}
                    />
                  </div>
                </div>

                {/* Excerpt */}
                <div className="text-xs text-slate-700 bg-[#F5F7FA] p-2.5 rounded-lg border border-slate-200/70 italic leading-relaxed mb-3">
                  "{source.excerpt}"
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {source.document_id.slice(0, 8)}...
                  </span>
                  <button
                    onClick={() => onInspectDocument(source.document_id, source.page_number)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] hover:text-[#115e59] hover:underline"
                  >
                    <span>Inspect Document</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
