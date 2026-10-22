# Stage 1: Build React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.11-slim AS runtime

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend Source
COPY backend ./backend

# Copy Built Frontend Distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create persistence directories
RUN mkdir -p data/chroma data/uploads

# Environment Defaults
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATA_DIR=/app/data \
    SQLITE_DB_PATH=/app/data/academic_ai.db \
    CHROMA_PERSIST_DIR=/app/data/chroma \
    UPLOAD_DIR=/app/data/uploads

EXPOSE 8000

# Start server binding to dynamic port
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
