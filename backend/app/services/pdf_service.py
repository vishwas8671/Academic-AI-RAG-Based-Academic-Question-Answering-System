import pymupdf as fitz  # Modern PyMuPDF import
import hashlib
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

class PDFProcessingError(Exception):
    """Base exception for PDF processing errors"""
    pass

class EncryptedPDFError(PDFProcessingError):
    """Exception raised when PDF is password protected"""
    pass

class CorruptPDFError(PDFProcessingError):
    """Exception raised when PDF is corrupt or invalid"""
    pass

class EmptyPDFError(PDFProcessingError):
    """Exception raised when PDF contains no pages or extractable text"""
    pass

class PDFService:
    @staticmethod
    def calculate_file_hash(file_bytes: bytes) -> str:
        """Computes SHA-256 hash of file content for duplicate detection."""
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """
        Cleans extracted text:
        - Reconnects hyphenated words broken across line breaks (e.g. 'struc-\nture' -> 'structure')
        - Normalizes irregular whitespace and tabs
        - Strips multiple consecutive empty lines
        """
        if not raw_text:
            return ""

        # Reconnect hyphenated words split across lines
        text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', raw_text)

        # Replace non-breaking spaces and other irregular spaces
        text = text.replace('\xa0', ' ').replace('\r\n', '\n').replace('\r', '\n')

        # Replace 3 or more newlines with two newlines (paragraph separator)
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Normalize excessive inline horizontal whitespace
        text = re.sub(r'[ \t]+', ' ', text)

        return text.strip()

    def extract_pages(self, file_path_or_bytes: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Extracts text from a PDF page-by-page.
        Returns:
            Tuple of:
            - List of page dicts: [{"page_number": int, "text": str, "char_count": int}]
            - Metadata dict: {"total_pages": int, "is_scanned": bool, "total_characters": int}
        """
        doc = None
        try:
            if isinstance(file_path_or_bytes, (str, Path)):
                doc = fitz.open(str(file_path_or_bytes))
            elif isinstance(file_path_or_bytes, bytes):
                doc = fitz.open(stream=file_path_or_bytes, filetype="pdf")
            else:
                raise CorruptPDFError("Invalid file input: must be file path or bytes.")

            if doc.is_encrypted:
                raise EncryptedPDFError("This PDF is password-protected or encrypted. Please decrypt it before uploading.")

            total_pages = len(doc)
            if total_pages == 0:
                raise EmptyPDFError("The uploaded PDF has 0 pages.")

            pages_data = []
            total_characters = 0

            for page_idx in range(total_pages):
                page = doc.load_page(page_idx)
                raw_text = page.get_text("text") or ""
                cleaned = self.clean_text(raw_text)
                char_count = len(cleaned)
                total_characters += char_count

                pages_data.append({
                    "page_number": page_idx + 1,  # 1-indexed for academic user clarity
                    "text": cleaned,
                    "char_count": char_count
                })

            # Detect if document appears to be scanned (has pages but virtually no extractable text)
            avg_chars_per_page = total_characters / total_pages if total_pages > 0 else 0
            is_scanned = (total_characters < 50 and total_pages > 0) or (avg_chars_per_page < 30)

            metadata = {
                "total_pages": total_pages,
                "page_count": total_pages,
                "is_scanned": is_scanned,
                "total_characters": total_characters
            }

            return pages_data, metadata

        except fitz.FileDataError as e:
            logger.error(f"PyMuPDF FileDataError: {str(e)}")
            raise CorruptPDFError(f"Corrupted or invalid PDF file: {str(e)}")
        except (EncryptedPDFError, EmptyPDFError, CorruptPDFError):
            raise
        except Exception as e:
            logger.error(f"Unexpected error parsing PDF: {str(e)}")
            raise PDFProcessingError(f"Failed to process PDF: {str(e)}")
        finally:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass

    def chunk_pages(
        self,
        pages: List[Dict[str, Any]],
        chunk_size: int = 800,
        chunk_overlap: int = 120
    ) -> List[Dict[str, Any]]:
        """
        Splits page texts into chunks while preserving 1-indexed page_number and offsets.
        """
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
        except ImportError:
            class SimpleSplitter:
                def __init__(self, c_size, c_overlap):
                    self.c_size = c_size
                    self.c_overlap = c_overlap
                def split_text(self, text: str) -> List[str]:
                    chunks = []
                    start = 0
                    while start < len(text):
                        end = min(start + self.c_size, len(text))
                        chunks.append(text[start:end])
                        if end == len(text):
                            break
                        start += (self.c_size - self.c_overlap)
                    return chunks
            splitter = SimpleSplitter(chunk_size, chunk_overlap)

        all_chunks: List[Dict[str, Any]] = []
        global_chunk_idx = 0

        for page in pages:
            page_num = page["page_number"]
            page_text = page["text"]
            if not page_text.strip():
                continue

            split_texts = splitter.split_text(page_text)
            for split_t in split_texts:
                if len(split_t.strip()) < 10:
                    continue
                all_chunks.append({
                    "chunk_index": global_chunk_idx,
                    "text": split_t.strip(),
                    "page_number": page_num,
                    "char_count": len(split_t.strip())
                })
                global_chunk_idx += 1

        return all_chunks

    chunk_document_pages = chunk_pages

pdf_service = PDFService()
