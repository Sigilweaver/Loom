"""Authentication routes"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    """Login request body"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response with access token"""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Current user info"""
    username: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest) -> LoginResponse:
    """Authenticate user and return access token"""
    # TODO: Implement actual authentication with database
    # For now, accept any credentials for development
    if request.username and request.password:
        return LoginResponse(
            access_token="development_token",
            token_type="bearer",
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )


@router.post("/logout")
async def logout() -> dict[str, str]:
    """Logout current user"""
    # Stateless JWT - client just discards token
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user() -> UserResponse:
    """Get current user info"""
    # TODO: Implement with actual JWT validation
    return UserResponse(
        username="admin",
        role="admin",
    )
