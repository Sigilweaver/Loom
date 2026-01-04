"""Tests for connection permission boundaries."""


def database_connection_payload(name: str = "Test Connection") -> dict:
    """Generate a standard database connection payload.
    
    New unified format requires:
    - type: "database" (not "postgresql")
    - db_type: "postgresql"
    """
    return {
        "type": "database",
        "name": name,
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "testdb",
        "username": "testuser",
        "password": "testpass",
    }
