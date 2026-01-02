#!/usr/bin/env python3
"""Seed script for development - creates test users with all roles via API.

Creates:
- Owner (password: password) - first user, becomes owner automatically
- Admin (password: password) - created by owner, then promoted to admin
- Auditor (password: password) - created by owner, then promoted to auditor  
- User (password: password) - created by owner, stays as user

Usage:
    cd hub/backend
    uv run scripts/seed_dev_users.py
    
    # Or with custom hub URL:
    uv run scripts/seed_dev_users.py --hub-url http://localhost:25802

Requirements:
    - Hub API must be running
    - Database should be empty (or users shouldn't exist yet)
"""

import argparse
import sys

import httpx


DEFAULT_HUB_URL = "http://localhost:25802"
API_BASE = "/api/v1"
DEFAULT_PASSWORD = "password"

# Users to create in order (first becomes owner automatically)
DEV_USERS = [
    {"username": "Owner", "target_role": "owner"},  # First user = owner
    {"username": "Admin", "target_role": "admin"},
    {"username": "Auditor", "target_role": "auditor"},
    {"username": "User", "target_role": "user"},
]


def check_auth_status(client: httpx.Client) -> dict:
    """Check if hub is initialized and get user count."""
    resp = client.get(f"{API_BASE}/auth/status")
    resp.raise_for_status()
    return resp.json()


def register_user(client: httpx.Client, username: str, password: str, token: str | None = None) -> dict:
    """Register a new user. Returns login response with token."""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    resp = client.post(
        f"{API_BASE}/auth/register",
        json={"username": username, "password": password},
        headers=headers,
    )
    
    if resp.status_code == 409:
        print(f"  ⚠ User '{username}' already exists, skipping")
        return None
    
    resp.raise_for_status()
    return resp.json()


def login_user(client: httpx.Client, username: str, password: str) -> dict:
    """Login and get token."""
    resp = client.post(
        f"{API_BASE}/auth/login",
        json={"username": username, "password": password},
    )
    resp.raise_for_status()
    return resp.json()


def update_user_role(client: httpx.Client, user_id: str, role: str, token: str) -> dict:
    """Update a user's role (requires admin/owner)."""
    resp = client.patch(
        f"{API_BASE}/users/{user_id}",
        json={"role": role},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()


def list_users(client: httpx.Client, token: str) -> list[dict]:
    """List all users."""
    resp = client.get(
        f"{API_BASE}/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()["users"]


def seed_users(hub_url: str) -> None:
    """Create dev users via the Hub API."""
    client = httpx.Client(base_url=hub_url, timeout=10.0)
    
    try:
        # Check hub status
        status = check_auth_status(client)
        existing_count = status["user_count"]
        print(f"Hub status: {existing_count} existing users")
        
        owner_token = None
        created = []
        skipped = []
        
        for i, user_data in enumerate(DEV_USERS):
            username = user_data["username"]
            target_role = user_data["target_role"]
            
            print(f"\nProcessing: {username} (target role: {target_role})")
            
            if i == 0:
                # First user in our list - should be owner
                if existing_count == 0:
                    # No users exist, register without auth (becomes owner)
                    result = register_user(client, username, DEFAULT_PASSWORD)
                    if result:
                        owner_token = result["access_token"]
                        created.append(username)
                        print(f"  ✓ Created as owner")
                    else:
                        print(f"  ✗ Failed to create owner")
                        sys.exit(1)
                else:
                    # Users exist, try to login as owner
                    try:
                        login_result = login_user(client, username, DEFAULT_PASSWORD)
                        owner_token = login_result["access_token"]
                        skipped.append(username)
                        print(f"  → Logged in as existing user")
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 401:
                            print(f"  ⚠ User '{username}' doesn't exist or wrong password")
                            print(f"    Hub already has {existing_count} users - cannot create new owner")
                            print(f"    Try resetting the database: cd hub/backend && docker compose down -v && docker compose up -d")
                        else:
                            raise
                        sys.exit(1)
            else:
                # Subsequent users - need owner token
                if not owner_token:
                    print(f"  ✗ No owner token available, cannot create {username}")
                    continue
                
                result = register_user(client, username, DEFAULT_PASSWORD, owner_token)
                if result:
                    user_id = result["user"]["id"]
                    created.append(username)
                    print(f"  ✓ Created as user")
                    
                    # Promote to target role if not 'user'
                    if target_role != "user":
                        update_user_role(client, user_id, target_role, owner_token)
                        print(f"  ✓ Promoted to {target_role}")
                else:
                    skipped.append(username)
        
        # Summary
        print("\n" + "=" * 40)
        if created:
            print(f"✓ Created: {', '.join(created)}")
        if skipped:
            print(f"- Skipped (already exist): {', '.join(skipped)}")
        
        print(f"\nAll passwords: {DEFAULT_PASSWORD}")
        print(f"Login at: {hub_url.replace(':25802', ':25803')}")
        
    finally:
        client.close()


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Seed development users via Hub API")
    parser.add_argument(
        "--hub-url",
        default=DEFAULT_HUB_URL,
        help=f"Hub API URL (default: {DEFAULT_HUB_URL})",
    )
    args = parser.parse_args()
    
    print("=" * 40)
    print("  Sigilweaver Dev User Seeder")
    print("=" * 40)
    print(f"Hub URL: {args.hub_url}")
    
    try:
        seed_users(args.hub_url)
    except httpx.ConnectError:
        print(f"\n✗ Cannot connect to Hub at {args.hub_url}")
        print("  Make sure the Hub is running: ./scripts/dev.py --hub")
        sys.exit(1)
    except httpx.HTTPStatusError as e:
        print(f"\n✗ HTTP error: {e.response.status_code} - {e.response.text}")
        sys.exit(1)
    
    print("=" * 40)
    print("Done!")


if __name__ == "__main__":
    main()
