import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status

from backend.app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    SessionResponse,
    SessionDetailResponse,
    ChatMessage
)
from backend.app.repositories.db import db
from backend.app.services.retrieval_service import retrieval_service
from backend.app.services.generation_service import generation_service
from backend.app.services.citation_service import citation_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chat"])

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    Primary RAG query endpoint.
    Performs retrieval against persistent vector store, constructs context-grounded prompt,
    generates response using selected model, validates citations, and persists chat history.
    """
    user_query = request.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query message cannot be empty.")

    # 1. Resolve or initialize chat session
    session_id = request.session_id
    if not session_id or not db.get_session(session_id):
        session_id = str(uuid.uuid4())
        # Generate short title from the first query (first 6 words)
        short_title = " ".join(user_query.split()[:6])
        if len(short_title) > 40:
            short_title = short_title[:37] + "..."
        db.create_session(session_id, title=short_title)

    # 2. Persist user message in SQLite
    user_msg_id = str(uuid.uuid4())
    db.create_message(
        msg_id=user_msg_id,
        session_id=session_id,
        role="user",
        content=user_query,
        sources=[],
        mode=request.mode
    )

    # 3. Retrieve relevant chunks for grounded context
    retrieved_chunks, context_str = retrieval_service.retrieve_relevant_chunks(
        query=user_query,
        document_ids=request.document_ids,
        top_k=request.top_k
    )

    # 4. Fetch prior session history for multi-turn conversational context
    history_records = db.get_session_messages(session_id)
    # Convert to standard role/content dicts, excluding the message just added
    conv_history = [{"role": m["role"], "content": m["content"]} for m in history_records[:-1]]

    # 5. Generate grounded answer
    raw_answer = generation_service.generate_answer(
        query=user_query,
        context_str=context_str,
        retrieved_chunks=retrieved_chunks,
        conversation_history=conv_history,
        mode=request.mode
    )

    # 6. Validate cited sources strictly against retrieved chunks
    validated_citations, is_refusal = citation_service.validate_citations(
        answer_text=raw_answer,
        retrieved_chunks=retrieved_chunks
    )

    # 7. Persist assistant message in SQLite
    asst_msg_id = str(uuid.uuid4())
    citations_data = [c.dict() for c in validated_citations]
    db.create_message(
        msg_id=asst_msg_id,
        session_id=session_id,
        role="assistant",
        content=raw_answer,
        sources=citations_data,
        mode=request.mode
    )

    return ChatResponse(
        session_id=session_id,
        message_id=asst_msg_id,
        role="assistant",
        content=raw_answer,
        sources=validated_citations,
        mode=request.mode,
        is_refusal=is_refusal
    )

@router.get("/sessions", response_model=List[SessionResponse])
def list_sessions():
    """Returns list of active chat sessions."""
    sessions = db.list_sessions()
    return [SessionResponse(**s) for s in sessions]

@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session(session_id: str):
    """Retrieves full conversation history for a specific chat session."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    raw_messages = db.get_session_messages(session_id)
    messages = [ChatMessage(**m) for m in raw_messages]

    return SessionDetailResponse(
        id=session["id"],
        title=session["title"],
        created_at=session["created_at"],
        updated_at=session["updated_at"],
        messages=messages
    )

@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_session(session_id: str):
    """Deletes a chat session and its associated messages."""
    deleted = db.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"message": "Session deleted successfully.", "session_id": session_id}
