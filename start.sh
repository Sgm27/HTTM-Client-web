#!/usr/bin/env bash
set -euo pipefail

# Start backend
(cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &

# Start frontend
(cd frontend && npm run dev -- --host 0.0.0.0 --port 5173) &

# Wait for both
wait
