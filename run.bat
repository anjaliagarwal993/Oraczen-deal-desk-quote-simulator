@echo off
REM Windows: double-click or run run.bat (needs Python 3.10+ and Node 18+)
start "backend" cmd /k "cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt && uvicorn app.main:app --port 8000"
start "frontend" cmd /k "cd frontend && npm install && npm run dev"
echo Open http://localhost:3000
