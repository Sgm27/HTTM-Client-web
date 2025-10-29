#!/usr/bin/env bash
set -euo pipefail

# Start backend
(cd server && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000) &

# Start frontend
(cd client && npm run dev -- --host 0.0.0.0 --port 5173) &

# Wait for both
wait
