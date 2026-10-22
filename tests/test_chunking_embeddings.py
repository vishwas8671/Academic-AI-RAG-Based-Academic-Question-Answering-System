import pytest
from backend.app.services.pdf_service import pdf_service
from backend.app.services.embedding_service import embedding_service

def test_document_chunking():
    pages = [
        {
            "page_number": 1,
            "text": "Chapter 1: Operating Systems Basics.\n" + ("Virtual memory maps logical to physical frames. " * 30)
        },
        {
            "page_number": 2,
            "text": "Chapter 2: Concurrency & Semaphores.\n" + ("Dijkstra introduced binary and counting semaphores. " * 30)
        }
    ]
    
    chunks = pdf_service.chunk_document_pages(
        pages=pages,
        chunk_size=400,
        chunk_overlap=50
    )
    
    assert len(chunks) > 2
    # Verify metadata is retained on all chunks
    for chunk in chunks:
        assert "chunk_index" in chunk
        assert "text" in chunk
        assert "page_number" in chunk
        assert chunk["page_number"] in [1, 2]
        assert len(chunk["text"]) > 0

def test_deterministic_embedding_fallback():
    text1 = "Byzantine fault tolerance requires 3f + 1 total replicas in asynchronous networks."
    text2 = "Byzantine fault tolerance requires 3f + 1 total replicas in asynchronous networks."
    text3 = "Photosynthesis is the process by which green plants convert light energy into chemical energy."
    
    vec1 = embedding_service.generate_query_embedding(text1, provider="test_offline")
    vec2 = embedding_service.generate_query_embedding(text2, provider="test_offline")
    vec3 = embedding_service.generate_query_embedding(text3, provider="test_offline")
    
    assert len(vec1) == 384
    assert vec1 == vec2  # Exact match for identical text
    assert vec1 != vec3  # Substantially different text yields different embedding
    
    # Check normalization: sum of squares ≈ 1.0
    norm_sq = sum(x * x for x in vec1)
    assert abs(norm_sq - 1.0) < 1e-3
