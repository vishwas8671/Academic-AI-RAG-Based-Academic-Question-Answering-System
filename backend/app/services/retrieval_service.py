import logging
from typing import List, Dict, Any, Optional, Tuple
from backend.app.core.config import settings
from backend.app.services.embedding_service import embedding_service
from backend.app.services.vector_store_service import vector_store_service

logger = logging.getLogger(__name__)

class RetrievalService:
    def retrieve_relevant_chunks(
        self,
        query: str,
        document_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Retrieves top_k chunks for the query, filtered by document_ids if provided.
        Returns:
            Tuple of:
            - List of chunk dicts
            - Formatted context string with document names and page numbers for the LLM
        """
        k = top_k or settings.DEFAULT_TOP_K

        # 1. Generate embedding for query
        query_embedding = embedding_service.generate_query_embedding(query)

        # 2. Query ChromaDB vector store
        chunks = vector_store_service.query(
            query_embedding=query_embedding,
            top_k=k,
            document_ids=document_ids
        )

        if not chunks:
            return [], ""

        # 3. Format grounded context with unambiguous citation labels
        context_blocks = []
        for idx, chunk in enumerate(chunks, start=1):
            doc_name = chunk.get("filename", "Unknown Document")
            page_num = chunk.get("page_number", 1)
            chunk_text = chunk.get("text", "").strip()

            block = (
                f"[Source {idx}] (Document: {doc_name}, Page: {page_num})\n"
                f"{chunk_text}\n"
            )
            context_blocks.append(block)

        formatted_context = "\n---\n".join(context_blocks)
        return chunks, formatted_context

retrieval_service = RetrievalService()
