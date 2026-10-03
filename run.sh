#!/usr/bin/env bash
# One command to start everything: ./run.sh   (needs Python 3.10+ and Node 18+)
set -e
cd "$(dirname "$0")"
(cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -q -r requirements.txt && uvicorn app.main:app --port 8000) &
(cd frontend && npm install && npm run dev) &
echo "Open http://localhost:3000  (API docs: http://localhost:8000/docs)"
wait
