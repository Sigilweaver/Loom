"""Write the Hub's OpenAPI schema to a JSON file (or stdout).

Used by the frontend type generator (`bun run gen:api` in hub/frontend). Runs
without a database: only the route and schema definitions are imported.

    uv run python scripts/export_openapi.py [output.json]
"""

import json
import os
import sys
from pathlib import Path

# Importing the app validates secrets; the schema does not depend on them.
os.environ.setdefault("ALLOW_INSECURE_DEFAULTS", "1")

from app.main import application  # noqa: E402


def main() -> None:
    text = json.dumps(application.openapi(), indent=2, sort_keys=True) + "\n"
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
