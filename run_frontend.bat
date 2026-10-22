@echo off
echo ===================================================
echo Starting Academic AI Frontend Dev Server (Vite)
echo Running on http://localhost:5173
echo ===================================================

cd /d "%~dp0frontend"
cmd.exe /c "npm run dev"
pause
