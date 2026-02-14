"""AI proxy endpoints

Provides a reverse proxy for LLM provider API calls, solving CORS
restrictions when Studio runs in web/browser mode. In Electron mode,
calls go direct; in web mode they route through this proxy.

Also provides a model listing endpoint for the settings UI.
"""

import logging
import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

# -------------------------------------------------------------------------
# Provider base URLs
# -------------------------------------------------------------------------

PROVIDER_URLS: dict[str, str] = {
    "openai": "https://api.openai.com",
    "anthropic": "https://api.anthropic.com",
    "google": "https://generativelanguage.googleapis.com",
    "mistral": "https://api.mistral.ai",
}

# Headers that should NOT be forwarded between client and upstream
_HOP_BY_HOP = frozenset({
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "proxy-authorization",
    "proxy-authenticate",
    "origin",
    "referer",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-dest",
})


# -------------------------------------------------------------------------
# Model listing
# -------------------------------------------------------------------------

class ModelListRequest(BaseModel):
    """Request to list models from a provider."""
    provider: str
    api_key: str | None = None
    base_url: str | None = None


class ModelInfo(BaseModel):
    """Simplified model info."""
    id: str
    name: str | None = None
    owned_by: str | None = None


class ModelListResponse(BaseModel):
    """Response with available models."""
    models: list[ModelInfo]


@router.post("/models", response_model=ModelListResponse)
async def list_models(req: ModelListRequest) -> ModelListResponse:
    """
    List available models from an LLM provider.

    Makes a server-side request to the provider's model listing API,
    avoiding CORS restrictions that block browser-side calls.
    """
    try:
        models = await _fetch_models(req.provider, req.api_key, req.base_url)
        return ModelListResponse(models=models)
    except httpx.HTTPStatusError as e:
        logger.warning("model_list_failed provider=%s status=%d", req.provider, e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Provider returned {e.response.status_code}: {e.response.text[:200]}",
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Could not connect to provider")
    except Exception as e:
        logger.error("model_list_error provider=%s error=%s", req.provider, str(e))
        raise HTTPException(status_code=502, detail=str(e))


async def _fetch_models(
    provider: str,
    api_key: str | None,
    base_url: str | None,
) -> list[ModelInfo]:
    """Fetch models from a provider API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        if provider == "openai" or provider == "openai-compatible":
            url = f"{base_url or 'https://api.openai.com'}/v1/models"
            headers: dict[str, str] = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [
                ModelInfo(id=m["id"], owned_by=m.get("owned_by"))
                for m in data.get("data", [])
            ]

        elif provider == "anthropic":
            url = "https://api.anthropic.com/v1/models"
            headers = {
                "x-api-key": api_key or "",
                "anthropic-version": "2023-06-01",
            }
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [
                ModelInfo(id=m["id"], name=m.get("display_name"))
                for m in data.get("data", [])
            ]

        elif provider == "google":
            url = "https://generativelanguage.googleapis.com/v1beta/models"
            params: dict[str, str] = {"pageSize": "100"}
            if api_key:
                params["key"] = api_key
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            return [
                ModelInfo(
                    id=m.get("baseModelId", m["name"].removeprefix("models/")),
                    name=m.get("displayName"),
                )
                for m in data.get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]

        elif provider == "mistral":
            url = "https://api.mistral.ai/v1/models"
            headers = {"Authorization": f"Bearer {api_key or ''}"}
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [
                ModelInfo(id=m["id"], owned_by=m.get("owned_by"))
                for m in data.get("data", [])
            ]

        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


# -------------------------------------------------------------------------
# Reverse proxy for LLM API calls
# -------------------------------------------------------------------------

@router.api_route(
    "/proxy/{provider}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
)
async def proxy_llm_request(
    provider: str,
    path: str,
    request: Request,
) -> Response:
    """
    Reverse proxy for LLM provider API calls.

    Routes requests to the correct provider base URL, forwarding headers
    and body. This solves CORS restrictions when Studio runs in web mode.

    Usage from Studio:
      Instead of calling https://api.anthropic.com/v1/messages
      Call http://localhost:25811/api/ai/proxy/anthropic/v1/messages

    For openai-compatible providers, pass the base URL as a query param:
      /api/ai/proxy/openai-compatible/v1/chat/completions?base_url=http://localhost:11434
    """
    # Resolve base URL
    if provider == "openai-compatible":
        base_url = request.query_params.get("base_url", "http://localhost:11434")
    else:
        base_url = PROVIDER_URLS.get(provider)
        if not base_url:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    upstream_url = f"{base_url}/{path}"

    # Forward headers, stripping hop-by-hop
    forward_headers: dict[str, str] = {}
    for key, value in request.headers.items():
        if key.lower() not in _HOP_BY_HOP:
            forward_headers[key] = value

    # Read request body
    body = await request.body()

    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            upstream_resp = await client.request(
                method=request.method,
                url=upstream_url,
                headers=forward_headers,
                content=body if body else None,
                params={
                    k: v
                    for k, v in request.query_params.items()
                    if k != "base_url"
                } or None,
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Could not connect to {provider}")
        except httpx.ReadTimeout:
            raise HTTPException(status_code=504, detail="Upstream timeout")

    # Forward response headers, stripping hop-by-hop
    response_headers: dict[str, str] = {}
    for key, value in upstream_resp.headers.items():
        if key.lower() not in _HOP_BY_HOP and key.lower() != "content-encoding":
            response_headers[key] = value

    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=response_headers,
    )
