import io
import pytest
from fastapi.testclient import TestClient
import pymupdf as fitz
from backend.app.main import app

client = TestClient(app)

def create_sample_pdf_stream(title: str = "Operating Systems Syllabus") -> io.BytesIO:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (50, 72),
        f"Title: {title}\nCourse: CS401 Advanced Operating Systems\n"
        "Key Topics: Process Scheduling, Mutual Exclusion, Paging, Virtual Memory.\n"
        "Grading: Midterm 30%, Final Exam 50%, Labs 20%.",
        fontsize=12
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return io.BytesIO(pdf_bytes)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "active_provider" in data

def test_settings_endpoints():
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "active_provider" in data
    assert "chunk_size" in data

    # Update settings
    update_res = client.post(
        "/api/settings",
        json={"chunk_size": 900, "default_top_k": 5}
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["chunk_size"] == 900
    assert updated_data["default_top_k"] == 5

def test_pdf_upload_and_chat_flow():
    # 1. Upload a sample PDF
    pdf_stream = create_sample_pdf_stream("CS401 Operating Systems")
    files = {"file": ("CS401_Syllabus.pdf", pdf_stream, "application/pdf")}
    upload_res = client.post("/api/documents/upload", files=files)
    assert upload_res.status_code in [200, 201]
    doc_data = upload_res.json()
    doc_id = doc_data["id"]
    assert doc_data["filename"] == "CS401_Syllabus.pdf"
    assert doc_data["chunk_count"] > 0

    # 2. Verify document in list
    list_res = client.get("/api/documents")
    assert list_res.status_code == 200
    docs = list_res.json()["documents"]
    assert any(d["id"] == doc_id for d in docs)

    # 3. Chat with the uploaded document
    chat_payload = {
        "message": "What is the grading breakdown in the syllabus?",
        "document_ids": [doc_id],
        "mode": "concise",
        "top_k": 3
    }
    chat_res = client.post("/api/chat", json=chat_payload)
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert "content" in chat_data
    assert "session_id" in chat_data
    assert len(chat_data["content"]) > 0

    session_id = chat_data["session_id"]

    # 4. Check sessions endpoint
    sessions_res = client.get("/api/sessions")
    assert sessions_res.status_code == 200
    sessions = sessions_res.json()
    assert any(s["id"] == session_id for s in sessions)

    # 5. Clean up document
    del_res = client.delete(f"/api/documents/{doc_id}")
    assert del_res.status_code == 200

    # Clean up session
    client.delete(f"/api/sessions/{session_id}")
