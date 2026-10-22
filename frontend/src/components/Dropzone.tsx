import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { DocumentItem } from '../types';

interface DropzoneProps {
  onUploadSuccess: (doc: DocumentItem) => void;
  isCompact?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onUploadSuccess, isCompact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Only academic PDF files are supported.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File exceeds 25MB limit. Please upload a smaller section or compressed PDF.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const doc: DocumentItem = await res.json();
      setSuccessMsg(`Successfully indexed "${doc.filename}" (${doc.page_count} pages, ${doc.chunk_count} chunks)`);
      onUploadSuccess(doc);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process and index PDF');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isCompact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 text-slate-500 hover:text-[#0F766E] hover:bg-slate-100 rounded-lg transition-colors"
          title="Upload Course PDF"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-[#0F766E]" /> : <UploadCloud className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#0F766E] bg-teal-50/50 scale-[1.01]'
            : 'border-[#E2E8F0] hover:border-[#0F766E]/50 bg-white hover:bg-slate-50/80 shadow-xs'
        } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-[#17324D] flex items-center justify-center shadow-inner">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#0F766E]" />
            ) : (
              <UploadCloud className="w-6 h-6 text-[#0F766E]" />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-[#172B4D]">
              {isUploading ? 'Ingesting, Chunking & Indexing PDF...' : 'Click or drag course PDF to upload'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Lecture slides, textbooks, syllabus, assignment sheets (up to 25MB)
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="mt-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#B91C1C] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
