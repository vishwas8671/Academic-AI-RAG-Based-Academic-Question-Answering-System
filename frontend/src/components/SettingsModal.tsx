import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Key,
  Server,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { SettingsData } from '../types';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [activeProvider, setActiveProvider] = useState('openai');
  const [openaiChatModel, setOpenaiChatModel] = useState('gpt-4o-mini');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaChatModel, setOllamaChatModel] = useState('llama3.2');
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [topK, setTopK] = useState(4);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setActiveProvider(data.active_provider);
      setOpenaiChatModel(data.openai_chat_model);
      setOllamaUrl(data.ollama_base_url);
      setOllamaChatModel(data.ollama_chat_model);
      setChunkSize(data.chunk_size);
      setChunkOverlap(data.chunk_overlap);
      setTopK(data.default_top_k);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await api.updateSettings({
        active_provider: activeProvider,
        openai_api_key: apiKey ? apiKey : undefined,
        openai_chat_model: openaiChatModel,
        ollama_base_url: ollamaUrl,
        ollama_chat_model: ollamaChatModel,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        default_top_k: topK,
      });
      setMessage({ type: 'success', text: 'Settings updated successfully.' });
      onSettingsUpdated();
      setApiKey(''); // Clear secret from input
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReindex = async () => {
    if (!window.confirm('Reindexing will re-chunk and regenerate embeddings for all documents on disk. Continue?')) {
      return;
    }
    setIsReindexing(true);
    setMessage(null);
    try {
      const res = await api.reindexAll();
      setMessage({
        type: 'success',
        text: `Reindexed ${res.details.reindexed_documents} documents (${res.details.total_chunks} passages).`,
      });
      onSettingsUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Reindexing failed.' });
    } finally {
      setIsReindexing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl border border-[#E2E8F0] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F5F7FA]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0F766E]" />
            <h2 className="font-bold text-base text-[#17324D]">Application Settings & Models</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {message && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-xs ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                  : 'bg-red-50 text-[#B91C1C] border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#0F766E]" />
            </div>
          ) : (
            <form id="settings-form" onSubmit={handleSave} className="space-y-5">
              {/* Active Provider */}
              <div>
                <label className="block text-xs font-bold text-[#172B4D] uppercase tracking-wider mb-2">
                  Active LLM Provider
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveProvider('openai')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      activeProvider === 'openai'
                        ? 'border-[#0F766E] bg-teal-50/40 ring-1 ring-[#0F766E]'
                        : 'border-[#E2E8F0] hover:bg-slate-50'
                    }`}
                  >
                    <Key className={`w-5 h-5 mt-0.5 ${activeProvider === 'openai' ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                    <div>
                      <p className="font-bold text-xs text-[#17324D]">OpenAI API</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Cloud-hosted, fast, 8GB laptop friendly</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProvider('ollama')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      activeProvider === 'ollama'
                        ? 'border-[#0F766E] bg-teal-50/40 ring-1 ring-[#0F766E]'
                        : 'border-[#E2E8F0] hover:bg-slate-50'
                    }`}
                  >
                    <Server className={`w-5 h-5 mt-0.5 ${activeProvider === 'ollama' ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                    <div>
                      <p className="font-bold text-xs text-[#17324D]">Ollama (Local)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Small local models (llama3.2)</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* OpenAI Config */}
              {activeProvider === 'openai' && (
                <div className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={settings?.openai_configured ? '•••••••••••••••••••••••••• (Configured)' : 'sk-...'}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Stored locally in server environment. Never exposed to browser.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chat Model
                    </label>
                    <select
                      value={openaiChatModel}
                      onChange={(e) => setOpenaiChatModel(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast & Recommended)</option>
                      <option value="gpt-4o">gpt-4o (High Rigor Academic Analysis)</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Ollama Config */}
              {activeProvider === 'ollama' && (
                <div className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ollama Base URL
                    </label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Local Chat Model
                    </label>
                    <input
                      type="text"
                      value={ollamaChatModel}
                      onChange={(e) => setOllamaChatModel(e.target.value)}
                      placeholder="llama3.2"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      For 8GB laptops, use lightweight 1B or 3B models (e.g. llama3.2:1b).
                    </p>
                  </div>
                </div>
              )}

              {/* RAG Parameters */}
              <div>
                <label className="block text-xs font-bold text-[#172B4D] uppercase tracking-wider mb-2">
                  RAG Pipeline Parameters
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Chunk Size
                    </label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value) || 800)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Chunk Overlap
                    </label>
                    <input
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 120)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Top-K Retrieval
                    </label>
                    <input
                      type="number"
                      value={topK}
                      min={1}
                      max={10}
                      onChange={(e) => setTopK(parseInt(e.target.value) || 4)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:border-[#0F766E]"
                    />
                  </div>
                </div>
              </div>

              {/* 8GB RAM Safety Profile Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-start gap-2.5 text-slate-600">
                <Cpu className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">8GB RAM Hardware Optimized</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Batched vector generation, disk-backed ChromaDB, and streaming PDF page extraction are active to avoid memory spikes.
                  </p>
                </div>
              </div>

              {/* Reindexing Action */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#172B4D]">Vector Store Synchronization</p>
                  <p className="text-[11px] text-slate-500">Re-chunk documents from disk into ChromaDB</p>
                </div>
                <button
                  type="button"
                  onClick={handleReindex}
                  disabled={isReindexing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  {isReindexing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{isReindexing ? 'Reindexing...' : 'Reindex Vectors'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-[#E2E8F0] flex justify-end gap-2 bg-[#F5F7FA]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="settings-form"
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115e59] rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
