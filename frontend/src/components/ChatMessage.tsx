import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  User,
  GraduationCap,
  AlertTriangle
} from 'lucide-react';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  onSelectCitation: (citationId: number) => void;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onSelectCitation,
  onRegenerate,
  isLastAssistant = false,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Replace citation markers [1], [2], [Source 1] with custom interactive links
  const renderFormattedContent = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          // Custom citation parser inside markdown text
          p: ({ children }) => {
            return (
              <p className="mb-3 leading-relaxed text-[#172B4D]">
                {React.Children.map(children, (child) => {
                  if (typeof child === 'string') {
                    // Match citations like [1], [2], [Source 1]
                    const parts = child.split(/(\[(?:Source\s*)?\d+\])/g);
                    return parts.map((part, i) => {
                      const match = part.match(/\[(?:Source\s*)?(\d+)\]/i);
                      if (match) {
                        const num = parseInt(match[1], 10);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSelectCitation(num)}
                            className="citation-tag"
                            title={`Jump to Source [${num}] in citation panel`}
                          >
                            [{num}]
                          </button>
                        );
                      }
                      return part;
                    });
                  }
                  return child;
                })}
              </p>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-[#17324D] text-white px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 mb-1 text-slate-300 text-[11px] font-semibold">
            <User className="w-3.5 h-3.5" />
            <span>You</span>
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-[#102438] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
        <GraduationCap className="w-4 h-4 text-teal-400" />
      </div>

      <div className="flex-1 max-w-[92%] sm:max-w-[85%]">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs">
          {/* Header info */}
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#172B4D]">Academic AI</span>
              {message.mode && (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  {message.mode}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors text-xs flex items-center gap-1"
                title="Copy answer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {isLastAssistant && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors text-xs flex items-center gap-1 ml-1"
                  title="Regenerate answer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Regenerate</span>
                </button>
              )}
            </div>
          </div>

          {/* Refusal indicator */}
          {message.is_refusal && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Context Boundary Notice</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Academic AI found no conclusive evidence in your uploaded documents for this question. It has refused to invent or hallucinate answers.
                </p>
              </div>
            </div>
          )}

          {/* Answer Body */}
          <div className="academic-prose text-sm">
            {renderFormattedContent(message.content)}
          </div>

          {/* Bottom Sources Bar */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#0F766E]" />
                Sources:
              </span>
              {message.sources.map((src) => (
                <button
                  key={src.citation_id}
                  onClick={() => onSelectCitation(src.citation_id)}
                  className="inline-flex items-center gap-1 text-[11px] bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 px-2 py-0.5 rounded transition-all"
                  title={`View passage from ${src.document_name} (Page ${src.page_number})`}
                >
                  <span className="font-semibold text-[#0F766E]">[{src.citation_id}]</span>
                  <span className="max-w-[120px] truncate">{src.document_name}</span>
                  <span className="text-slate-400 font-mono">p.{src.page_number}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
