import logging
from fastapi import APIRouter, HTTPException, status
from backend.app.core.config import settings
from backend.app.schemas.settings import SettingsResponse, SettingsUpdateRequest, HealthResponse
from backend.app.repositories.db import db
from backend.app.services.vector_store_service import vector_store_service
from backend.app.services.ingestion_service import ingestion_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["System"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    """Returns application health status, vector store counts, and active provider."""
    docs = db.list_documents()
    chunk_count = vector_store_service.get_chunk_count()

    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        active_provider=settings.ACTIVE_PROVIDER,
        documents_count=len(docs),
        total_chunks=chunk_count,
        chroma_status="connected",
        sqlite_status="connected"
    )

@router.post("/reindex")
def reindex_all():
    """
    Clears existing vector index and re-chunks/re-embeds all active documents from disk.
    Ensures vector index consistency after configuration changes.
    """
    try:
        result = ingestion_service.reindex_all()
        return {
            "message": "Reindexing completed successfully.",
            "details": result
        }
    except Exception as e:
        logger.error(f"Reindexing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Reindexing failed: {str(e)}")

@router.get("/settings", response_model=SettingsResponse)
def get_settings():
    """Retrieves current application settings and runtime configuration."""
    return SettingsResponse(
        active_provider=settings.ACTIVE_PROVIDER,
        openai_configured=bool(settings.OPENAI_API_KEY),
        openai_chat_model=settings.OPENAI_CHAT_MODEL,
        openai_embedding_model=settings.OPENAI_EMBEDDING_MODEL,
        ollama_base_url=settings.OLLAMA_BASE_URL,
        ollama_chat_model=settings.OLLAMA_CHAT_MODEL,
        ollama_embedding_model=settings.OLLAMA_EMBEDDING_MODEL,
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        default_top_k=settings.DEFAULT_TOP_K,
        max_upload_size_mb=settings.MAX_UPLOAD_SIZE_MB,
        ram_profile="8GB Laptop Optimized"
    )

@router.post("/settings", response_model=SettingsResponse)
def update_settings(update: SettingsUpdateRequest):
    """Updates runtime configuration (e.g. API keys, active provider, model selections)."""
    if update.active_provider is not None:
        settings.ACTIVE_PROVIDER = update.active_provider
    if update.openai_api_key is not None:
        settings.OPENAI_API_KEY = update.openai_api_key.strip()
    if update.openai_chat_model is not None:
        settings.OPENAI_CHAT_MODEL = update.openai_chat_model.strip()
    if update.openai_embedding_model is not None:
        settings.OPENAI_EMBEDDING_MODEL = update.openai_embedding_model.strip()
    if update.ollama_base_url is not None:
        settings.OLLAMA_BASE_URL = update.ollama_base_url.strip()
    if update.ollama_chat_model is not None:
        settings.OLLAMA_CHAT_MODEL = update.ollama_chat_model.strip()
    if update.ollama_embedding_model is not None:
        settings.OLLAMA_EMBEDDING_MODEL = update.ollama_embedding_model.strip()
    if update.chunk_size is not None and update.chunk_size > 50:
        settings.CHUNK_SIZE = update.chunk_size
    if update.chunk_overlap is not None and update.chunk_overlap >= 0:
        settings.CHUNK_OVERLAP = update.chunk_overlap
    if update.default_top_k is not None and update.default_top_k > 0:
        settings.DEFAULT_TOP_K = update.default_top_k

    return get_settings()
