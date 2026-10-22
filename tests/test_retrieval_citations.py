import pytest
import uuid
from backend.app.services.vector_store_service import vector_store_service
from backend.app.services.embedding_service import embedding_service
from backend.app.services.retrieval_service import retrieval_service
from backend.app.services.citation_service import citation_service

def test_vector_store_and_retrieval():
    doc_id_1 = str(uuid.uuid4())
    doc_id_2 = str(uuid.uuid4())
    
    text_1 = "The CAP theorem states that a distributed data store can only provide two of Consistency, Availability, and Partition tolerance simultaneously."
    text_2 = "The Krebs cycle is a series of chemical reactions used by all aerobic organisms to release stored energy through the oxidation of acetyl-CoA."
    
    emb_1 = embedding_service.generate_embeddings([text_1], provider="test_offline")
    emb_2 = embedding_service.generate_embeddings([text_2], provider="test_offline")
    
    vector_store_service.add_chunks(
        chunk_ids=[f"{doc_id_1}_0"],
        documents=[text_1],
        metadatas=[{
            "document_id": doc_id_1,
            "document_name": "Distributed_Systems.pdf",
            "page_number": 5,
            "chunk_index": 0
        }],
        embeddings=emb_1
    )
    
    vector_store_service.add_chunks(
        chunk_ids=[f"{doc_id_2}_0"],
        documents=[text_2],
        metadatas=[{
            "document_id": doc_id_2,
            "document_name": "Biochemistry_Notes.pdf",
            "page_number": 12,
            "chunk_index": 0
        }],
        embeddings=emb_2
    )
    
    # Query for CAP theorem using retrieval service
    results, _ = retrieval_service.retrieve_relevant_chunks(
        query="What trade-offs does the CAP theorem describe?",
        top_k=2
    )
    
    assert len(results) > 0
    top_result = results[0]
    assert "CAP theorem" in top_result["text"]
    assert top_result["document_id"] == doc_id_1
    assert top_result["page_number"] == 5
    
    # Clean up
    vector_store_service.delete_document_chunks(doc_id_1)
    vector_store_service.delete_document_chunks(doc_id_2)

def test_citation_mapping_and_validation():
    mock_retrieved = [
        {
            "document_id": "doc-abc",
            "document_name": "CS101_Lecture1.pdf",
            "page_number": 4,
            "text": "Turing completeness requires arbitrary loop constructs or unbounded recursion with sufficient memory.",
            "relevance_score": 0.88,
        },
        {
            "document_id": "doc-xyz",
            "document_name": "CS102_Lecture2.pdf",
            "page_number": 9,
            "text": "Von Neumann architecture features a shared memory space for both program instructions and execution data.",
            "relevance_score": 0.74,
        }
    ]
    
    raw_llm_response = (
        "According to the lecture, Turing completeness requires unbounded recursion [1]. "
        "Additionally, the Von Neumann architecture shares memory between code and data [2]."
    )
    
    citations, is_refusal = citation_service.validate_citations(
        raw_llm_response,
        mock_retrieved
    )
    
    assert is_refusal is False
    assert len(citations) == 2
    assert citations[0].document_name == "CS101_Lecture1.pdf"
    assert citations[0].page_number == 4
    assert citations[1].document_name == "CS102_Lecture2.pdf"
    assert citations[1].page_number == 9

def test_refusal_detection():
    refusal_response = "I am sorry, but the provided documents do not contain information about quantum entanglement."
    assert citation_service.is_refusal_response(refusal_response) is True
    
    factual_response = "Quantum entanglement is discussed on page 14 [1]."
    assert citation_service.is_refusal_response(factual_response) is False
