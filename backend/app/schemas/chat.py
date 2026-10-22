from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class Citation(BaseModel):
    citation_id: int
    document_id: str
    document_name: str
    page_number: int
    excerpt: str
    relevance_score: float

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1)
    document_ids: Optional[List[str]] = None
    mode: Literal["concise", "detailed", "exam"] = "detailed"
    top_k: Optional[int] = None

class ChatResponse(BaseModel):
    session_id: str
    message_id: str
    role: str = "assistant"
    content: str
    sources: List[Citation]
    mode: str
    is_refusal: bool = False

class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: List[Citation] = []
    mode: str = "detailed"
    created_at: str

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int

class SessionDetailResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[ChatMessage]
