import pytest
import pymupdf as fitz
from backend.app.services.pdf_service import pdf_service, PDFProcessingError

def create_sample_academic_pdf(num_pages: int = 2) -> bytes:
    """Helper to generate a clean synthetic academic PDF in memory."""
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842) # A4
        text = (
            f"Lecture Module {i + 1}: Foundations of Distributed Consensus\n\n"
            f"Section 1.{i + 1}: Byzantine Fault Tolerance and Safety Invariants.\n"
            "In any asynchronous network model with crash-recovery failures, "
            "consensus requires a supermajority of 2f + 1 nodes to guarantee safety "
            "and prevent network split-brain partitions.\n\n"
            f"Page number marker: {i + 1}."
        )
        page.insert_text((50, 72), text, fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_pdf_extraction_and_page_count():
    pdf_bytes = create_sample_academic_pdf(num_pages=3)
    pages, meta = pdf_service.extract_pages(pdf_bytes)
    
    assert len(pages) == 3
    assert pages[0]["page_number"] == 1
    assert "Foundations of Distributed Consensus" in pages[0]["text"]
    assert pages[1]["page_number"] == 2
    assert "Lecture Module 2" in pages[1]["text"]
    assert pages[2]["page_number"] == 3
    assert meta["page_count"] == 3

def test_pdf_hash_consistency():
    pdf_bytes = create_sample_academic_pdf(num_pages=1)
    hash_1 = pdf_service.calculate_file_hash(pdf_bytes)
    hash_2 = pdf_service.calculate_file_hash(pdf_bytes)
    assert hash_1 == hash_2
    assert len(hash_1) == 64  # SHA-256 hex string

def test_pdf_invalid_bytes_handling():
    corrupted_bytes = b"NOT_A_VALID_PDF_STREAM_12345"
    with pytest.raises(PDFProcessingError):
        pdf_service.extract_pages(corrupted_bytes)
