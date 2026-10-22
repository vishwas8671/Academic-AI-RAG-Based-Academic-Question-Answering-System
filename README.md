# Academic AI — RAG-Based Academic Question Answering System

An intelligent, citation-grounded Retrieval-Augmented Generation (RAG) assistant designed for university students, educators, and researchers. Students can upload course syllabi, textbooks, lecture slide PDFs, and past exam papers, and query them with strictly verified, clickable inline citations.

---

## 🌟 Key Highlights & Features

1. **Lightweight & 8GB RAM Laptop Friendly**:
   - Zero dedicated GPU requirement.
   - Streaming, page-by-page PDF parsing via **PyMuPDF (`fitz`)** with low memory footprint.
   - Batched chunking and persistent on-disk vector storage via **ChromaDB**.
   - Concurrency-ready **SQLite (WAL mode)** for relational session and message history.
   - **Deterministic Offline Embedding Fallback**: If no OpenAI API key or Ollama instance is configured, the system uses a high-performance 384-dimensional token/n-gram hashing embedding generator with cosine similarity matching, allowing 100% offline functionality.

2. **Accurate Page-Number Tracking & Grounding**:
   - Preserves 1-indexed student-friendly page numbers across every extracted chunk.
   - Strict citation verification: parses bracketed markers (`[1]`, `[2]`), validates them against retrieved chunks, and discards ungrounded references.
   - Refusal detection: explicitly detects when questions fall outside the uploaded syllabus/textbook contents and avoids hallucinations.

3. **Three Academic Answer Modes**:
   - **Concise**: Quick definitions, high-yield formulas, and executive summaries.
   - **Detailed**: In-depth explanations, step-by-step proofs, and comprehensive breakdowns.
   - **Exam Preparation**: Structured mnemonics, probable exam questions, key definitions, and bulleted takeaways.

4. **Multi-Document Filtering & Multi-Session Chat**:
   - Select individual documents or query across all uploaded materials simultaneously.
   - Persistent chat sessions stored in SQLite with full conversation restoration.
   - Duplicate PDF prevention using fast SHA-256 file hashing.

5. **Modern, Responsive UI/UX**:
   - Built with React 19, TypeScript, and Tailwind CSS.
   - Dark/Light mode support with smooth transitions.
   - Interactive Source Inspection panel displaying exact excerpt matches and relevance scores.
   - Built-in PDF Page Viewer modal to inspect the source material directly.

---

## 🏛 Architecture Overview

```mermaid
flowchart TD
    User([Student / User]) -->|Upload PDF / Ask Question| UI[React 19 + TypeScript Frontend]
    UI -->|REST API / CORS| API[FastAPI Backend Server]
    
    subgraph Ingestion Pipeline
        API -->|Page Extraction & Cleaning| PyMuPDF[PyMuPDF / fitz]
        PyMuPDF -->|Sliding Window Chunks| ChunkEngine[Semantic Chunking Engine]
        ChunkEngine -->|SHA-256 Hashing & Metas| SQLite[(SQLite DB - WAL Mode)]
        ChunkEngine -->|Embed Chunks| EmbService[Embedding Service]
        EmbService -->|OpenAI / Ollama / Offline 384d| Chroma[(ChromaDB Persistent Store)]
    end

    subgraph RAG Query Pipeline
        API -->|User Query| EmbQuery[Query Embedding]
        EmbQuery --> Chroma
        Chroma -->|Cosine Similarity Search| TopK[Top-K Chunks + Page #s]
        TopK --> ContextBuilder[Academic Context Builder]
        ContextBuilder --> GenEngine[Generation Engine]
        GenEngine -->|LLM / Fallback| RawAnswer[Raw Generated Answer]
        RawAnswer --> CitationVerifier[Citation & Refusal Verifier]
        CitationVerifier --> FinalResponse[Grounded Answer + [1], [2] Sources]
    end
    
    FinalResponse --> UI
```

---

## 📁 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routes (documents, chat, system)
│   │   ├── core/                # Configuration and environment settings
│   │   ├── repositories/        # SQLite database repository (WAL mode)
│   │   ├── services/            # Core business logic:
│   │   │   ├── pdf_service.py           # PyMuPDF page parsing and normalization
│   │   │   ├── embedding_service.py     # OpenAI / Ollama / Offline fallback
│   │   │   ├── vector_store_service.py  # ChromaDB persistent collection
│   │   │   ├── retrieval_service.py     # Semantic top-k search & context builder
│   │   │   ├── generation_service.py    # Multi-mode prompt & LLM completion
│   │   │   └── citation_service.py      # [1] verification & refusal detection
│   │   └── main.py              # Application entrypoint & SPA static hosting
│   ├── requirements.txt         # Pinned backend dependencies
│   └── .venv/                   # Virtual environment (Python 3.13)
├── frontend/
│   ├── src/
│   │   ├── components/          # Sidebar, Header, Dropzone, ChatMessage, SourcePanel, Modals
│   │   ├── services/api.ts      # Typed API client
│   │   ├── types/index.ts       # Shared TypeScript models
│   │   ├── App.tsx              # Main application shell
│   │   └── index.css            # Tailwind CSS styling tokens
│   ├── dist/                    # Pre-built production frontend bundle
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── academic_ai.db           # SQLite database
│   ├── chroma/                  # ChromaDB vector store
│   └── uploads/                 # Local document storage
├── tests/                       # Complete automated pytest suite
├── run_backend.bat              # One-click Windows startup for Backend
├── run_frontend.bat             # One-click Windows startup for Vite Dev
└── README.md
```

---

## ⚡ Quick Start

### Option 1: Single Server Mode (Production-ready, Recommended)
The frontend has already been built into `frontend/dist/`. The FastAPI backend automatically serves both the API endpoints and the compiled React SPA:

```cmd
run_backend.bat
```
Or manually:
```cmd
backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser!

---

### Option 2: Full Development Mode (Hot Reloading)

1. **Start Backend**:
   ```cmd
   run_backend.bat
   ```
2. **Start Frontend Dev Server**:
   ```cmd
   run_frontend.bat
   ```
   Open **[http://localhost:5173](http://localhost:5173)**.

---

## ⚙️ Configuration & Environment Variables

Copy `.env.example` to `.env` to configure optional external LLMs:

```env
# Provider Options: 'openai', 'ollama', or 'offline'
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai

# OpenAI Settings (Optional - offline fallback is active by default if omitted)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Local Ollama Settings (Optional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# RAG Hyperparameters
CHUNK_SIZE=800
CHUNK_OVERLAP=100
DEFAULT_TOP_K=4
```

> **Note on Offline Mode**: If no OpenAI API key is supplied and Ollama is not running, Academic AI automatically uses its built-in offline 384-dimensional embedding generator and rule-based academic answering engine. Everything continues to work seamlessly without external API keys or cloud dependencies.

---

## 🧪 Automated Testing

Academic AI includes a 100% automated test suite covering all modules:

```cmd
backend\.venv\Scripts\python.exe -m pytest tests -v
```

### Test Coverage Summary:
- **`test_pdf_processing.py`**: Validates PyMuPDF extraction, character counts, 1-indexed page tagging, SHA-256 deduplication, and corrupted byte detection.
- **`test_chunking_embeddings.py`**: Tests sliding window overlap chunking, metadata integrity, and deterministic normalized 384-dim vector generation.
- **`test_retrieval_citations.py`**: Tests ChromaDB upsert/retrieval, bracketed citation index verification, and refusal response detection.
- **`test_api_endpoints.py`**: End-to-end integration test verifying health, settings update, synthetic PDF upload, vector indexing, query chat flow, session persistence, and document deletion.

---

## 📚 API Endpoints

Interactive Swagger documentation is available at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health, vector store status, and chunk counts |
| `GET` | `/api/settings` | Current RAG parameters and active provider |
| `POST` | `/api/settings` | Update runtime chunk size, top-k, and provider |
| `POST` | `/api/documents/upload` | Upload and index academic PDF |
| `GET` | `/api/documents` | List all indexed documents |
| `GET` | `/api/documents/{id}/chunks` | Inspect raw extracted chunks with page numbers |
| `DELETE` | `/api/documents/{id}` | Remove document, its chunks, and vector embeddings |
| `POST` | `/api/chat` | Submit question with grounded citations & mode |
| `GET` | `/api/sessions` | List saved chat sessions |
| `GET` | `/api/sessions/{id}/messages`| Retrieve conversation history for a session |
| `DELETE` | `/api/sessions/{id}` | Delete a chat session |

---

## ☁️ Cloud Deployment (Render & Railway)

Academic AI is containerized with a production multi-stage `Dockerfile` and is pre-configured for 1-click cloud deployment.

### Option A: Deploy on Render (Recommended, Free)
1. Sign in to [Render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** and connect:
   `https://github.com/vishwas8671/Academic-AI-RAG-Based-Academic-Question-Answering-System`
4. Render will auto-detect the `Dockerfile` and `render.yaml`.
5. *(Optional)* Add your `OPENAI_API_KEY` under Environment Variables, or leave it blank to use the offline engine.
6. Click **Deploy Web Service** to get your public HTTPS URL (e.g. `https://academic-ai.onrender.com`).

### Option B: Deploy on Railway
1. Sign in to [Railway.app](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select `Academic-AI-RAG-Based-Academic-Question-Answering-System`.
4. Railway will automatically build the `Dockerfile` and deploy a live public domain.

