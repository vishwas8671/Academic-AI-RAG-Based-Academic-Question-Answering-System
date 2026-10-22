@echo off
echo ===================================================
echo Starting Academic AI Backend Server (FastAPI)
echo Serving API & React SPA on http://127.0.0.1:8000
echo ===================================================

cd /d "%~dp0"
if exist "backend\.venv\Scripts\python.exe" (
    backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
)
pause
