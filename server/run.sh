#!/bin/bash

# Set Polars verbose mode to avoid path truncation in errors
export POLARS_VERBOSE=1

# Run the FastAPI server with uvicorn using uv
uv run uvicorn app.main:app --reload --host ${HOST:-0.0.0.0} --port ${PORT:-8000}
