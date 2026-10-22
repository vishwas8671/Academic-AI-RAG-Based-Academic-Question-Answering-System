import React from 'react';
import { X, FileText, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  documentName?: string;
  initialPage?: number;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentName,
  initialPage = 1,
}) => {
  if (!isOpen || !documentId) return null;

  const fileUrl = `${api.getDocumentFileUrl(documentId)}#page=${initialPage}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-[#F5F7FA]">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-[#0F766E] shrink-0" />
            <h2 className="font-bold text-sm text-[#172B4D] truncate">
              {documentName || 'Course Document Inspection'}
            </h2>
            <span className="text-xs font-mono bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded">
              Page {initialPage}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={api.getDocumentFileUrl(documentId)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded text-xs flex items-center gap-1 transition-colors"
              title="Open raw PDF in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 bg-slate-100 p-1">
          <iframe
            src={fileUrl}
            title="PDF Document Viewer"
            className="w-full h-full border-0 rounded-lg bg-white"
          />
        </div>
      </div>
    </div>
  );
};
