"""Manual test script for metadata endpoint"""

import json

import requests

# Create a simple workflow with Input -> Filter
workflow = {
    "meta": {
        "name": "Test Workflow",
        "description": "Test metadata",
        "author": "Test",
        "workflowId": "test-1",
        "created": "2025-01-01T00:00:00",
    },
    "tools": [
        {
            "id": "input1",
            "type": "Input",
            "x": 0,
            "y": 0,
            "config": {
                "category": "file",
                "type": "csv",
                "source": "tests/fixtures/sample.csv",
            },
            "sockets": [{"id": 0, "direction": "output"}],
        },
        {
            "id": "filter1",
            "type": "Filter",
            "x": 200,
            "y": 0,
            "config": {"expression": "pl.col('age') > 30"},
            "sockets": [
                {"id": 0, "direction": "input"},
                {"id": 1, "direction": "output", "type": "T"},
                {"id": 2, "direction": "output", "type": "F"},
            ],
        },
    ],
    "wires": [
        {
            "from": {"tool": "input1", "socket": 0},
            "to": {"tool": "filter1", "socket": 0},
        }
    ],
}

# Test metadata endpoint
response = requests.post(
    "http://localhost:25811/api/workflow/tool/metadata",
    json={"tool_id": "filter1", "workflow": workflow},
)

print(f"Status: {response.status_code}")
print("\nResponse:")
data = response.json()
print(json.dumps(data, indent=2))

print("\n\nSummary:")
print(f"- Tool ID: {data['tool_id']}")
print(f"- Columns: {len(data['columns'])}")
print(f"- Polars Functions: {len(data['polars_functions'])}")

print("\n\nAvailable columns:")
for col in data['columns']:
    print(f"  - {col['name']} ({col['dtype']})")

print("\n\nSample Polars functions:")
for fn in data['polars_functions'][:5]:
    print(f"  - {fn['name']}: {fn['description']}")
    print(f"    Snippet: {fn['snippet']}")
