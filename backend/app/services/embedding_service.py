import math
import logging
import re
from typing import List, Optional
import httpx
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class EmbeddingError(Exception):
    """Exception raised during embedding generation"""
    pass

class EmbeddingService:
    def __init__(self):
        self._openai_client = None

    def _get_openai_client(self):
        if not settings.OPENAI_API_KEY:
            raise EmbeddingError("OpenAI API key is not configured. Please set OPENAI_API_KEY in settings or .env file.")
        if self._openai_client is None:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except ImportError:
                raise EmbeddingError("OpenAI package is not installed.")
        return self._openai_client

    def generate_embeddings(self, texts: List[str], provider: Optional[str] = None) -> List[List[float]]:
        """
        Generates embeddings for a list of texts using the selected or active provider.
        Batches requests to prevent memory exhaustion and respect rate limits.
        """
        if not texts:
            return []

        active = (provider or settings.ACTIVE_PROVIDER).lower()

        if active == "openai":
            if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("your_openai_api_key"):
                logger.warning("No valid OpenAI API key found; falling back to offline deterministic embeddings.")
                return self._embed_offline(texts)
            return self._embed_openai(texts)
        elif active == "ollama":
            return self._embed_ollama(texts)
        elif active in ["test_offline", "offline", "mock"]:
            return self._embed_offline(texts)
        else:
            if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("your_openai_api_key"):
                logger.warning("No OpenAI API key found; falling back to offline deterministic embeddings.")
                return self._embed_offline(texts)
            return self._embed_openai(texts)

    def generate_query_embedding(self, query: str, provider: Optional[str] = None) -> List[float]:
        """Generates embedding for a single query string."""
        results = self.generate_embeddings([query], provider=provider)
        if not results:
            raise EmbeddingError("Failed to generate embedding for query.")
        return results[0]

    def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        client = self._get_openai_client()
        batch_size = settings.EMBEDDING_BATCH_SIZE
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            # Replace empty strings with a single space as OpenAI rejects empty text
            sanitized_batch = [t if t.strip() else " " for t in batch]
            try:
                response = client.embeddings.create(
                    model=settings.OPENAI_EMBEDDING_MODEL,
                    input=sanitized_batch
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
            except Exception as e:
                logger.error(f"OpenAI embedding error: {str(e)}")
                raise EmbeddingError(f"OpenAI Embedding API error: {str(e)}")

        return all_embeddings

    def _embed_ollama(self, texts: List[str]) -> List[List[float]]:
        base_url = settings.OLLAMA_BASE_URL.rstrip('/')
        url = f"{base_url}/api/embeddings"
        embeddings: List[List[float]] = []

        with httpx.Client(timeout=30.0) as client:
            for text in texts:
                try:
                    payload = {
                        "model": settings.OLLAMA_EMBEDDING_MODEL,
                        "prompt": text if text.strip() else " "
                    }
                    resp = client.post(url, json=payload)
                    if resp.status_code != 200:
                        raise EmbeddingError(f"Ollama returned status {resp.status_code}: {resp.text}")
                    data = resp.json()
                    embeddings.append(data["embedding"])
                except httpx.ConnectError:
                    raise EmbeddingError(f"Cannot connect to Ollama at {base_url}. Ensure Ollama is running.")
                except Exception as e:
                    logger.error(f"Ollama embedding error: {str(e)}")
                    raise EmbeddingError(f"Ollama embedding error: {str(e)}")

        return embeddings

    def _embed_offline(self, texts: List[str], dim: int = 384) -> List[List[float]]:
        """
        Deterministic, lightweight token/n-gram hashing embedding generator (384-dim).
        Requires 0 external APIs, 0 GPU, and <1MB RAM.
        Preserves semantic overlap: texts sharing words/stems get high cosine similarity!
        Ideal for automated tests and offline verification.
        """
        import zlib
        all_embeddings = []
        for text in texts:
            vec = [0.0] * dim
            tokens = re.findall(r'\b[a-zA-Z0-9_]{2,}\b', text.lower())
            
            if not tokens:
                all_embeddings.append([1.0 / math.sqrt(dim)] * dim)
                continue

            # Project words and character 3-grams to vector slots
            for token in tokens:
                # Word hash slot
                slot_w = zlib.crc32(token.encode('utf-8')) % dim
                weight_w = 1.0 + min(len(token), 10) * 0.1
                vec[slot_w] += weight_w

                # 3-gram slots for subword matching
                for i in range(max(0, len(token) - 2)):
                    trigram = token[i:i+3]
                    slot_tri = zlib.crc32(trigram.encode('utf-8')) % dim
                    vec[slot_tri] += 0.3

            # L2 normalize vector
            norm = math.sqrt(sum(x * x for x in vec))
            if norm > 0:
                vec = [x / norm for x in vec]
            else:
                vec = [1.0 / math.sqrt(dim)] * dim

            all_embeddings.append(vec)

        return all_embeddings

embedding_service = EmbeddingService()
