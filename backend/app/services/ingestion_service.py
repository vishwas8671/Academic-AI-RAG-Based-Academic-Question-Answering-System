import os
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from backend.app.core.config import settings
from backend.app.repositories.db import db
from backend.app.services.pdf_service import pdf_service, PDFProcessingError
from backend.app.services.embedding_service import embedding_service
from backend.app.services.vector_store_service import vector_store_service

logger = logging.getLogger(__name__)

class IngestionError(Exception):
    """Exception raised during ingestion"""
    pass

class IngestionService:
    def __init__(self):
        self._splitter = None

    def _get_splitter(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        size = chunk_size or settings.CHUNK_SIZE
        overlap = chunk_overlap or settings.CHUNK_OVERLAP
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            return RecursiveCharacterTextSplitter(
                chunk_size=size,
                chunk_overlap=overlap,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
        except ImportError:
            # Simple fallback splitter if langchain_text_splitters is not yet installed
            class FallbackSplitter:
                def __init__(self, c_size, c_overlap):
                    self.c_size = c_size
                    self.c_overlap = c_overlap

                def split_text(self, text: str) -> List[str]:
                    if not text:
                        return []
                    chunks = []
                    start = 0
                    while start < len(text):
                        end = min(start + self.c_size, len(text))
                        chunks.append(text[start:end])
                        if end == len(text):
                            break
                        start += (self.c_size - self.c_overlap)
                    return chunks

            return FallbackSplitter(size, overlap)

    def validate_upload(self, filename: str, file_size: int):
        """Validates filename extension and size."""
        ext = Path(filename).suffix.lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise IngestionError(f"Unsupported file format '{ext}'. Only academic PDF files are supported.")

        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise IngestionError(
                f"File size exceeds limit of {settings.MAX_UPLOAD_SIZE_MB}MB. (Uploaded: {file_size / (1024*1024):.1f}MB)"
            )
        if file_size == 0:
            raise IngestionError("Uploaded file is empty (0 bytes).")

    def ingest_pdf(
        self,
        filename: str,
        file_bytes: bytes,
        force_reindex: bool = False
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Ingests a PDF file into the RAG pipeline.
        Returns:
            Tuple of:
            - Document dict
            - is_duplicate boolean
        """
        file_size = len(file_bytes)
        self.validate_upload(filename, file_size)

        # 1. Duplicate detection via SHA-256 hash
        file_hash = pdf_service.calculate_file_hash(file_bytes)
        existing_doc = db.get_document_by_hash(file_hash)

        if existing_doc and not force_reindex:
            logger.info(f"Duplicate file detected: '{filename}' matches existing document ID {existing_doc['id']}")
            return existing_doc, True

        doc_id = str(uuid.uuid4())
        safe_filename = Path(filename).name
        saved_file_name = f"{doc_id}_{safe_filename}"
        storage_path = settings.UPLOAD_DIR / saved_file_name

        # 2. Extract pages and validate PDF
        try:
            pages_data, metadata = pdf_service.extract_pages(file_bytes)
        except PDFProcessingError as e:
            raise IngestionError(str(e))

        # 3. Save physical file to disk
        with open(storage_path, "wb") as f:
            f.write(file_bytes)

        # 4. Chunk splitting with page-number metadata preservation
        splitter = self._get_splitter()
        chunk_ids: List[str] = []
        chunk_texts: List[str] = []
        metadatas: List[Dict[str, Any]] = []

        chunk_counter = 0
        for page in pages_data:
            page_num = page["page_number"]
            page_text = page["text"]
            if not page_text.strip():
                continue

            splits = splitter.split_text(page_text)
            for split_idx, split_text in enumerate(splits):
                cleaned_split = split_text.strip()
                if len(cleaned_split) < 10:  # Skip tiny fragments
                    continue

                cid = f"{doc_id}_p{page_num}_{chunk_counter}"
                chunk_ids.append(cid)
                chunk_texts.append(cleaned_split)
                metadatas.append({
                    "chunk_id": cid,
                    "document_id": doc_id,
                    "filename": safe_filename,
                    "page_number": page_num
                })
                chunk_counter += 1

        # 5. Generate embeddings and store in ChromaDB
        if chunk_texts:
            embeddings = embedding_service.generate_embeddings(chunk_texts)
            vector_store_service.add_chunks(
                chunk_ids=chunk_ids,
                documents=chunk_texts,
                metadatas=metadatas,
                embeddings=embeddings
            )

        # 6. Record in SQLite repository
        doc_record = db.create_document({
            "id": doc_id,
            "filename": safe_filename,
            "file_hash": file_hash,
            "file_size": file_size,
            "page_count": metadata["total_pages"],
            "chunk_count": len(chunk_ids),
            "status": "indexed",
            "storage_path": str(storage_path)
        })

        return doc_record, False

    def delete_document(self, document_id: str) -> bool:
        """Deletes vectors, physical file, and database record."""
        doc = db.get_document(document_id)
        if not doc:
            return False

        # 1. Delete vectors from ChromaDB
        vector_store_service.delete_document_chunks(document_id)

        # 2. Delete physical file from disk
        storage_path = Path(doc["storage_path"])
        if storage_path.exists():
            try:
                storage_path.unlink()
            except Exception as e:
                logger.warning(f"Could not delete physical file {storage_path}: {str(e)}")

        # 3. Delete from SQLite
        db.delete_document(document_id)
        return True

    def reindex_all(self) -> Dict[str, Any]:
        """Reindexes all active documents from disk into ChromaDB."""
        docs = db.list_documents()
        vector_store_service.reset()
        
        reindexed_count = 0
        total_chunks = 0

        for doc in docs:
            storage_path = Path(doc["storage_path"])
            if not storage_path.exists():
                continue

            with open(storage_path, "rb") as f:
                file_bytes = f.read()

            pages_data, _ = pdf_service.extract_pages(file_bytes)
            splitter = self._get_splitter()
            
            chunk_ids = []
            chunk_texts = []
            metadatas = []
            counter = 0

            for page in pages_data:
                splits = splitter.split_text(page["text"])
                for s in splits:
                    cleaned = s.strip()
                    if len(cleaned) < 10:
                        continue
                    cid = f"{doc['id']}_p{page['page_number']}_{counter}"
                    chunk_ids.append(cid)
                    chunk_texts.append(cleaned)
                    metadatas.append({
                        "chunk_id": cid,
                        "document_id": doc["id"],
                        "filename": doc["filename"],
                        "page_number": page["page_number"]
                    })
                    counter += 1

            if chunk_texts:
                embeddings = embedding_service.generate_embeddings(chunk_texts)
                vector_store_service.add_chunks(
                    chunk_ids=chunk_ids,
                    documents=chunk_texts,
                    metadatas=metadatas,
                    embeddings=embeddings
                )

            db.update_document_chunk_count(doc["id"], len(chunk_ids))
            reindexed_count += 1
            total_chunks += len(chunk_ids)

        return {"reindexed_documents": reindexed_count, "total_chunks": total_chunks}

ingestion_service = IngestionService()
