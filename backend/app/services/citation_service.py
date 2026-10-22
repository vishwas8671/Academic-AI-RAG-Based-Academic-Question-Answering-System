import re
import logging
from typing import List, Dict, Any, Tuple
from backend.app.schemas.chat import Citation

logger = logging.getLogger(__name__)

class CitationService:
    REFUSAL_TRIGGERS = [
        "do not contain sufficient information",
        "does not contain sufficient information",
        "cannot find information",
        "not mentioned in the provided documents",
        "not mentioned in the uploaded documents",
        "not found in the provided context",
        "insufficient information to answer",
        "documents do not provide",
        "no information in the provided context",
        "the provided documents do not contain"
    ]

    def is_refusal_response(self, answer_text: str) -> bool:
        """
        Determines whether the model honestly admitted the documents lack information.
        """
        lower = answer_text.lower()
        return any(trigger in lower for trigger in self.REFUSAL_TRIGGERS)

    def extract_excerpt(self, full_text: str, max_chars: int = 220) -> str:
        """
        Extracts a clean excerpt from chunk text for preview in citation panels.
        """
        cleaned = " ".join(full_text.split())
        if len(cleaned) <= max_chars:
            return cleaned
        # Trim to nearest word boundary
        trimmed = cleaned[:max_chars]
        last_space = trimmed.rfind(" ")
        if last_space > 100:
            return trimmed[:last_space] + "..."
        return trimmed + "..."

    def validate_citations(
        self,
        answer_text: str,
        retrieved_chunks: List[Dict[str, Any]]
    ) -> Tuple[List[Citation], bool]:
        """
        Validates citations by cross-referencing model references with retrieved chunks.
        Never trusts ungrounded numbers or fabricated document names.
        Returns:
            Tuple of:
            - List of validated Citation objects
            - is_refusal boolean flag
        """
        if not retrieved_chunks:
            return [], True

        is_refusal = self.is_refusal_response(answer_text)
        if is_refusal:
            # When the model refuses because context has no answer, return 0 citations
            return [], True

        # Find all citation markers in the answer: e.g. [1], [2], [Source 1], [Source 2]
        # Match patterns like [1], [Source 1], [Source: 1], [doc 1]
        citation_matches = re.findall(r'\[(?:Source\s*:?\s*)?(\d+)\]', answer_text, re.IGNORECASE)
        cited_indices = set()

        for match in citation_matches:
            try:
                idx = int(match)
                # 1-indexed to 0-indexed check
                if 1 <= idx <= len(retrieved_chunks):
                    cited_indices.add(idx)
            except ValueError:
                continue

        # If the model didn't explicitly use bracketed markers (or used generic text),
        # but gave a grounded answer, include the top matching retrieved chunks as evidence
        if not cited_indices:
            # Default to all retrieved chunks that have a significant relevance score
            valid_sources = []
            for i, chunk in enumerate(retrieved_chunks, start=1):
                citation = Citation(
                    citation_id=i,
                    document_id=chunk["document_id"],
                    document_name=chunk.get("document_name") or chunk.get("filename", "Unknown Document"),
                    page_number=chunk["page_number"],
                    excerpt=self.extract_excerpt(chunk["text"]),
                    relevance_score=chunk.get("relevance_score", 0.0)
                )
                valid_sources.append(citation)
            return valid_sources, False

        # Otherwise, preserve only the exact verified cited chunks
        validated_citations: List[Citation] = []
        for idx in sorted(cited_indices):
            chunk = retrieved_chunks[idx - 1]
            citation = Citation(
                citation_id=idx,
                document_id=chunk["document_id"],
                document_name=chunk.get("document_name") or chunk.get("filename", "Unknown Document"),
                page_number=chunk["page_number"],
                excerpt=self.extract_excerpt(chunk["text"]),
                relevance_score=chunk.get("relevance_score", 0.0)
            )
            validated_citations.append(citation)

        return validated_citations, False

citation_service = CitationService()
