import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse

from backend.app.schemas.document import DocumentResponse, DocumentListResponse
from backend.app.repositories.db import db
from backend.app.services.ingestion_service import ingestion_service, IngestionError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.get("", response_model=DocumentListResponse)
def list_documents():
    """Returns list of all ingested academic documents with metadata."""
    docs = db.list_documents()
    total_chunks = sum(d.get("chunk_count", 0) for d in docs)
    return DocumentListResponse(
        documents=[DocumentResponse(**d) for d in docs],
        total_count=len(docs),
        total_chunks=total_chunks
    )

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    """
    Uploads and indexes an academic PDF file.
    Validates file format, detects duplicates via SHA-256 hash, extracts text,
    splits into chunks, generates embeddings, and persists to ChromaDB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file has no filename.")

    try:
        file_bytes = await file.read()
        doc_record, is_duplicate = ingestion_service.ingest_pdf(
            filename=file.filename,
            file_bytes=file_bytes
        )
        return DocumentResponse(**doc_record)
    except IngestionError as e:
        logger.warning(f"Ingestion error for '{file.filename}': {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected upload failure: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {str(e)}")

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str):
    """Retrieves metadata for a specific document."""
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentResponse(**doc)

@router.get("/{document_id}/file")
def get_document_file(document_id: str):
    """Serves the raw PDF file for viewing and page verification in the UI."""
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    storage_path = Path(doc["storage_path"])
    if not storage_path.exists():
        raise HTTPException(status_code=404, detail="Physical PDF file missing from storage.")

    return FileResponse(
        path=str(storage_path),
        filename=doc["filename"],
        media_type="application/pdf"
    )

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(document_id: str):
    """Deletes document metadata, stored PDF, and vector embeddings in ChromaDB."""
    deleted = ingestion_service.delete_document(document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found or already deleted.")
    return {"message": "Document and associated vectors deleted successfully.", "document_id": document_id}
