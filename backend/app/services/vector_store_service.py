import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "academic_ai_docs"

class VectorStoreService:
    def __init__(self, persist_dir: Optional[Path] = None):
        self.persist_dir = str(persist_dir or settings.CHROMA_PERSIST_DIR)
        self._client = None
        self._collection = None

    def _get_client(self):
        if self._client is None:
            try:
                import chromadb
                Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
                self._client = chromadb.PersistentClient(path=self.persist_dir)
            except Exception as e:
                logger.error(f"Failed to initialize ChromaDB PersistentClient: {str(e)}")
                raise
        return self._client

    def _get_collection(self):
        if self._collection is None:
            client = self._get_client()
            # Cosine distance space: distance = 1 - cosine_similarity
            self._collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    def add_chunks(
        self,
        chunk_ids: List[str],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> int:
        """
        Adds or upserts chunk embeddings, texts, and metadata into ChromaDB.
        """
        if not chunk_ids:
            return 0

        collection = self._get_collection()
        try:
            collection.upsert(
                ids=chunk_ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            logger.info(f"Successfully stored {len(chunk_ids)} chunks in ChromaDB.")
            return len(chunk_ids)
        except Exception as e:
            err_msg = str(e)
            if "dimension" in err_msg.lower():
                logger.warning(f"ChromaDB dimension mismatch detected: {err_msg}. Recreating collection.")
                client = self._get_client()
                try:
                    client.delete_collection(name=COLLECTION_NAME)
                except Exception:
                    pass
                self._collection = client.get_or_create_collection(
                    name=COLLECTION_NAME,
                    metadata={"hnsw:space": "cosine"}
                )
                self._collection.upsert(
                    ids=chunk_ids,
                    documents=documents,
                    metadatas=metadatas,
                    embeddings=embeddings
                )
                logger.info(f"Successfully recreated collection and stored {len(chunk_ids)} chunks.")
                return len(chunk_ids)

            logger.error(f"Error adding chunks to ChromaDB: {str(e)}")
            raise

    def query(
        self,
        query_embedding: List[float],
        top_k: int = 4,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic search against ChromaDB.
        Returns top_k matching chunks with similarity score in [0.0, 1.0].
        """
        collection = self._get_collection()
        
        # Build filter condition if specific documents are selected
        where_filter = None
        if document_ids and len(document_ids) > 0:
            if len(document_ids) == 1:
                where_filter = {"document_id": document_ids[0]}
            else:
                where_filter = {"document_id": {"$in": document_ids}}

        total_in_collection = collection.count()
        if total_in_collection == 0:
            return []

        # Bound top_k to total items in collection
        actual_k = min(top_k, total_in_collection)

        kwargs = {
            "query_embeddings": [query_embedding],
            "n_results": actual_k,
            "include": ["documents", "metadatas", "distances"]
        }
        if where_filter:
            kwargs["where"] = where_filter

        try:
            results = collection.query(**kwargs)
        except Exception as e:
            logger.error(f"ChromaDB query error: {str(e)}")
            # If filtered query returns nothing or fails, return empty list
            return []

        retrieved: List[Dict[str, Any]] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return []

        ids = results["ids"][0]
        docs = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        for cid, doc_text, meta, dist in zip(ids, docs, metadatas, distances):
            # Chroma returns cosine distance (0 to 2, where 0 is identical)
            # Similarity = max(0.0, 1.0 - distance)
            sim_score = max(0.0, min(1.0, 1.0 - float(dist)))
            
            doc_name = meta.get("filename") or meta.get("document_name", "Unknown")
            retrieved.append({
                "chunk_id": cid,
                "document_id": meta.get("document_id", ""),
                "filename": doc_name,
                "document_name": doc_name,
                "page_number": int(meta.get("page_number", 1)),
                "text": doc_text,
                "relevance_score": round(sim_score, 4)
            })

        return retrieved

    def delete_document_chunks(self, document_id: str) -> int:
        """
        Deletes all chunks associated with a specific document ID.
        """
        collection = self._get_collection()
        try:
            # Query existing chunks for this document
            existing = collection.get(where={"document_id": document_id})
            ids_to_delete = existing.get("ids", [])
            if ids_to_delete:
                collection.delete(ids=ids_to_delete)
                logger.info(f"Deleted {len(ids_to_delete)} vectors for document {document_id}")
                return len(ids_to_delete)
            return 0
        except Exception as e:
            logger.error(f"Error deleting chunks for document {document_id}: {str(e)}")
            return 0

    def reset(self):
        """Resets the collection by deleting and recreating it."""
        client = self._get_client()
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
        self._collection = None

    def get_chunk_count(self) -> int:
        """Returns total vectors stored in the collection."""
        try:
            return self._get_collection().count()
        except Exception:
            return 0

vector_store_service = VectorStoreService()
vector_store = vector_store_service
