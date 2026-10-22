import sqlite3
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pathlib import Path
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class DatabaseRepository:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = str(db_path or settings.SQLITE_DB_PATH)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for concurrency and performance
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def _init_db(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Documents table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                page_count INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'indexed',
                storage_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """)

            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
            """)

            # Sessions table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """)

            # Messages table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources_json TEXT NOT NULL DEFAULT '[]',
                mode TEXT NOT NULL DEFAULT 'detailed',
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
            """)

            conn.commit()

    # Document operations
    def create_document(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
            INSERT INTO documents (id, filename, file_hash, file_size, page_count, chunk_count, status, storage_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                doc_data["id"],
                doc_data["filename"],
                doc_data["file_hash"],
                doc_data["file_size"],
                doc_data["page_count"],
                doc_data.get("chunk_count", 0),
                doc_data.get("status", "indexed"),
                doc_data["storage_path"],
                now
            ))
            conn.commit()
            return self.get_document(doc_data["id"])

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def get_document_by_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE file_hash = ?", (file_hash,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def list_documents(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    def update_document_chunk_count(self, doc_id: str, chunk_count: int, status: str = "indexed"):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE documents SET chunk_count = ?, status = ? WHERE id = ?", (chunk_count, status, doc_id))
            conn.commit()

    def delete_document(self, doc_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Session operations
    def create_session(self, session_id: str, title: str = "New Discussion") -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
            INSERT INTO sessions (id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """, (session_id, title, now, now))
            conn.commit()
            return {"id": session_id, "title": title, "created_at": now, "updated_at": now, "message_count": 0}

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
            row = cursor.fetchone()
            if not row:
                return None
            session = dict(row)
            cursor.execute("SELECT COUNT(*) as count FROM messages WHERE session_id = ?", (session_id,))
            session["message_count"] = cursor.fetchone()["count"]
            return session

    def list_sessions(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
            FROM sessions s
            ORDER BY s.updated_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]

    def update_session_title(self, session_id: str, title: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now(timezone.utc).isoformat()
            cursor.execute("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?", (title, now, session_id))
            conn.commit()

    def touch_session(self, session_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now(timezone.utc).isoformat()
            cursor.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (now, session_id))
            conn.commit()

    def delete_session(self, session_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Message operations
    def create_message(self, msg_id: str, session_id: str, role: str, content: str, sources: List[Dict[str, Any]] = None, mode: str = "detailed") -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now(timezone.utc).isoformat()
            sources_json = json.dumps(sources or [])
            cursor.execute("""
            INSERT INTO messages (id, session_id, role, content, sources_json, mode, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (msg_id, session_id, role, content, sources_json, mode, now))
            
            # Touch session updated_at
            cursor.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (now, session_id))
            conn.commit()

            return {
                "id": msg_id,
                "session_id": session_id,
                "role": role,
                "content": content,
                "sources": sources or [],
                "mode": mode,
                "created_at": now
            }

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
            messages = []
            for row in cursor.fetchall():
                msg = dict(row)
                try:
                    msg["sources"] = json.loads(msg["sources_json"])
                except Exception:
                    msg["sources"] = []
                del msg["sources_json"]
                messages.append(msg)
            return messages

# Global singleton repository
db = DatabaseRepository()
