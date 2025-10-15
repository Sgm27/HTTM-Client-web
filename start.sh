#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

VENV_DIR="$BACKEND_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip
fi

"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

pushd "$BACKEND_DIR" >/dev/null
"$VENV_DIR/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
popd >/dev/null

cleanup() {
  if ps -p $BACKEND_PID > /dev/null 2>&1; then
    kill $BACKEND_PID
  fi
  if [ -n "${FRONTEND_PID:-}" ] && ps -p $FRONTEND_PID > /dev/null 2>&1; then
    kill $FRONTEND_PID
  fi
}

trap cleanup EXIT INT TERM

pushd "$FRONTEND_DIR" >/dev/null
if [ ! -d node_modules ]; then
  npm install
fi
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!
popd >/dev/null

wait $BACKEND_PID $FRONTEND_PID
