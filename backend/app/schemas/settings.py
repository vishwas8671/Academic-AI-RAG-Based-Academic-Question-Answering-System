from typing import List, Optional
from pydantic import BaseModel

class SettingsResponse(BaseModel):
    active_provider: str
    openai_configured: bool
    openai_chat_model: str
    openai_embedding_model: str
    ollama_base_url: str
    ollama_chat_model: str
    ollama_embedding_model: str
    chunk_size: int
    chunk_overlap: int
    default_top_k: int
    max_upload_size_mb: int
    ram_profile: str = "8GB Laptop Optimized"

class SettingsUpdateRequest(BaseModel):
    active_provider: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_chat_model: Optional[str] = None
    openai_embedding_model: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_chat_model: Optional[str] = None
    ollama_embedding_model: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    default_top_k: Optional[int] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    active_provider: str
    documents_count: int
    total_chunks: int
    chroma_status: str
    sqlite_status: str
