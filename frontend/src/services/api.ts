import type {
  DocumentItem,
  DocumentListResponse,
  SessionItem,
  SessionDetail,
  SettingsData,
  HealthData
} from '../types';

const API_BASE = '/api';

export const api = {
  // Health
  getHealth: async (): Promise<HealthData> => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  // Documents
  getDocuments: async (): Promise<DocumentListResponse> => {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  uploadDocument: async (file: File): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  deleteDocument: async (documentId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  getDocumentFileUrl: (documentId: string): string => {
    return `${API_BASE}/documents/${documentId}/file`;
  },

  // Chat
  sendMessage: async (params: {
    sessionId?: string;
    message: string;
    documentIds?: string[];
    mode: 'concise' | 'detailed' | 'exam';
    topK?: number;
  }): Promise<{
    session_id: string;
    message_id: string;
    role: 'assistant';
    content: string;
    sources: any[];
    mode: string;
    is_refusal: boolean;
  }> => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: params.sessionId,
        message: params.message,
        document_ids: params.documentIds && params.documentIds.length > 0 ? params.documentIds : undefined,
        mode: params.mode,
        top_k: params.topK,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate answer' }));
      throw new Error(err.detail || 'Failed to generate answer');
    }
    return res.json();
  },

  // Sessions
  getSessions: async (): Promise<SessionItem[]> => {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error('Failed to load chat history');
    return res.json();
  },

  getSession: async (sessionId: string): Promise<SessionDetail> => {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    if (!res.ok) throw new Error('Failed to load session details');
    return res.json();
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete session');
  },

  // Reindex
  reindexAll: async (): Promise<{ message: string; details: any }> => {
    const res = await fetch(`${API_BASE}/reindex`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Reindexing failed');
    return res.json();
  },

  // Settings
  getSettings: async (): Promise<SettingsData> => {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (settings: Partial<SettingsData> & { openai_api_key?: string }): Promise<SettingsData> => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },
};
