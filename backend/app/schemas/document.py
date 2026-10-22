from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class DocumentBase(BaseModel):
    filename: str
    file_size: int
    page_count: int

class DocumentCreate(DocumentBase):
    id: str
    file_hash: str
    storage_path: str
    chunk_count: int = 0
    status: str = "indexed"

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: int
    chunk_count: int
    file_hash: str
    status: str
    created_at: str

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total_count: int
    total_chunks: int

class ChunkMetadata(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    page_number: int
    char_start: Optional[int] = 0
    char_end: Optional[int] = 0

class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    page_number: int
    text: str
    relevance_score: float
