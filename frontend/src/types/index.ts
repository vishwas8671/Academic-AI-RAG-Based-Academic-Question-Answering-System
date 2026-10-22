export interface Citation {
  citation_id: number;
  document_id: string;
  document_name: string;
  page_number: number;
  excerpt: string;
  relevance_score: number;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_size: number;
  page_count: number;
  chunk_count: number;
  file_hash: string;
  status: string;
  created_at: string;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total_count: number;
  total_chunks: number;
}

export interface Message {
  id: string;
  session_id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Citation[];
  mode?: 'concise' | 'detailed' | 'exam';
  created_at?: string;
  is_refusal?: boolean;
}

export interface SessionItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface SettingsData {
  active_provider: string;
  openai_configured: boolean;
  openai_chat_model: string;
  openai_embedding_model: string;
  ollama_base_url: string;
  ollama_chat_model: string;
  ollama_embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  default_top_k: number;
  max_upload_size_mb: number;
  ram_profile: string;
}

export interface HealthData {
  status: string;
  version: string;
  active_provider: string;
  documents_count: number;
  total_chunks: number;
  chroma_status: string;
  sqlite_status: string;
}
