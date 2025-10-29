#!/bin/bash

# Activate virtual environment
source .venv/bin/activate

# Run the FastAPI server with uvicorn
uvicorn app.main:app --reload --host ${HOST:-0.0.0.0} --port ${PORT:-8000}
