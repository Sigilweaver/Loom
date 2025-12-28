#!/usr/bin/env python3
"""
Seed development data for Hub.

Creates:
- A test user for development (test@example.com / testpass)
- A development server registration (localhost:8000 with token 'dev-server-token')

Run this after starting Hub for the first time:
    cd hub/backend && uv run python ../scripts/seed_dev.py
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy import select
from app.db.database import async_session_maker, engine
from app.db.models import Base, User, Server


async def seed_dev_data() -> None:
    """Create development seed data."""
    
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with async_session_maker() as session:
        # Check if test user exists
        result = await session.execute(
            select(User).where(User.username == "testuser")
        )
        user = result.scalar_one_or_none()
        
        if not user:
            # Create test user
            from app.domain.auth.password import hash_password
            user = User(
                id=uuid4(),
                username="testuser",
                password_hash=hash_password("testpass"),
                role="admin",
            )
            session.add(user)
            print("Created test user: testuser / testpass")
        else:
            print("Test user already exists: testuser")
        
        # Check if dev server exists
        result = await session.execute(
            select(Server).where(Server.auth_token == "dev-server-token")
        )
        server = result.scalar_one_or_none()
        
        if not server:
            # Create dev server
            server = Server(
                id=uuid4(),
                name="Local Dev Server",
                endpoint_url="http://localhost:8000",
                auth_token="dev-server-token",
                status="unknown",
                created_by="seed_dev",
            )
            session.add(server)
            print("Created dev server: http://localhost:8000 (token: dev-server-token)")
        else:
            print(f"Dev server already exists: {server.endpoint_url}")
        
        await session.commit()
    
    print("\nDevelopment seed data ready!")
    print("Login: testuser / testpass")
    print("You can now use --hub-auth with ./scripts/dev.py")


if __name__ == "__main__":
    asyncio.run(seed_dev_data())
