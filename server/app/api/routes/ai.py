"""AI proxy endpoints

Provides a reverse proxy for LLM provider API calls, solving CORS
restrictions. Studio routes every LLM call through this proxy, in both
desktop and web mode, since both run in a browser renderer.

Streaming: The proxy preserves SSE streaming semantics end-to-end.
LLM providers send Server-Sent Events; this proxy forwards each chunk
to Studio as it arrives via ``StreamingResponse``, enabling true
progressive token display.

Also provides a model listing endpoint for the settings UI.
"""

import ipaddress
import logging
import socket
from collections.abc import AsyncIterator
from urllib.parse import urlparse, urlunparse

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings

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
_HOP_BY_HOP = frozenset(
    {
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
    }
)

# Headers allowed to be forwarded TO upstream providers.
# Uses an allowlist (not blocklist) to prevent leaking auth tokens (C4).
_FORWARD_ALLOWLIST = frozenset(
    {
        "content-type",
        "accept",
        "x-api-key",
        "anthropic-version",
        "anthropic-beta",
        "openai-organization",
        "user-agent",
    }
)


_NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")


def _embedded_ipv4(
    addr: ipaddress.IPv4Address | ipaddress.IPv6Address,
) -> ipaddress.IPv4Address | None:
    """The IPv4 address an IPv6 address carries (IPv4-mapped, 6to4, NAT64), if any."""
    if not isinstance(addr, ipaddress.IPv6Address):
        return None
    if addr.ipv4_mapped is not None:
        return addr.ipv4_mapped
    if addr.sixtofour is not None:
        return addr.sixtofour
    if addr in _NAT64_PREFIX:
        return ipaddress.IPv4Address(int(addr) & 0xFFFFFFFF)
    return None


def _reject_if_unsafe(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> None:
    """Raise if an IP falls in a range the proxy must never target.

    Anything that is not a globally routable address is refused. That covers the
    shared/CGNAT range (100.64.0.0/10, used by some cloud metadata services) which
    is neither "private" nor "reserved" to the ipaddress module, and IPv6 forms that
    wrap an internal IPv4 address.
    """
    embedded = _embedded_ipv4(addr)
    candidates = [addr] if embedded is None else [addr, embedded]
    for candidate in candidates:
        if (
            candidate.is_private
            or candidate.is_loopback
            or candidate.is_link_local
            or candidate.is_reserved
            or candidate.is_multicast
            or candidate.is_unspecified
            or not candidate.is_global
        ):
            raise HTTPException(
                status_code=400,
                detail="Upstream URL must not target private or internal networks",
            )


def _validate_upstream_url(url: str) -> str:
    """Block SSRF by rejecting URLs that resolve to internal/private networks.

    Unlike a bare IP-literal check, this resolves DNS hostnames and applies the
    same private/loopback/link-local/reserved checks to every resolved address,
    so an attacker-controlled name that resolves to ``127.0.0.1`` or a cloud
    metadata endpoint is rejected. The first validated address is returned so
    the caller can connect to that exact IP rather than re-resolving (which
    would reopen a DNS-rebinding TOCTOU window).

    Args:
        url: Upstream base URL supplied by the caller.

    Returns:
        A validated IP literal (as a string) safe to connect to.

    Raises:
        HTTPException: If the URL is malformed or targets a private, loopback,
            link-local, reserved, multicast, or unspecified address.
    """
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid upstream URL")

    # Block common internal hostnames outright (defence in depth; the DNS
    # resolution below would catch most of these anyway).
    _blocked_hostnames = {
        "localhost",
        "metadata.google.internal",
        "instance-data",
    }
    if hostname.lower() in _blocked_hostnames:
        raise HTTPException(
            status_code=400,
            detail="Upstream URL must not target internal services",
        )

    # IP literal: validate directly.
    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None
    if literal is not None:
        _reject_if_unsafe(literal)
        return str(literal)

    # DNS name: resolve and validate EVERY answer. A single unsafe answer
    # rejects the whole request rather than letting us cherry-pick a safe one,
    # since which address the real connection would use is not guaranteed.
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not resolve upstream host: {hostname}"
        ) from exc

    resolved: list[str] = []
    for info in infos:
        ip_str = str(info[4][0])
        _reject_if_unsafe(ipaddress.ip_address(ip_str))
        resolved.append(ip_str)

    if not resolved:
        raise HTTPException(
            status_code=400, detail=f"Could not resolve upstream host: {hostname}"
        )
    return resolved[0]


def _pin_host(url: str, ip: str) -> tuple[str, str]:
    """Rewrite ``url``'s host to a validated IP, returning (pinned_url, host).

    The original hostname is returned so the caller can preserve it for the
    ``Host`` header and TLS SNI, keeping name-based virtual hosting and
    certificate validation working while the connection targets the pinned IP.
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""
    netloc_host = f"[{ip}]" if ":" in ip else ip
    if parsed.port:
        netloc_host = f"{netloc_host}:{parsed.port}"
    pinned = urlunparse(parsed._replace(netloc=netloc_host))
    return pinned, host


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
        logger.warning(
            "model_list_failed provider=%s status=%d", req.provider, e.response.status_code
        )
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
            base = base_url or "https://api.openai.com"
            sni: str | None = None
            # openai-compatible base_url is caller-controlled: same SSRF guard
            # and IP pinning as the streaming proxy.
            if provider == "openai-compatible" and base_url:
                safe_ip = _validate_upstream_url(base)
                base, sni = _pin_host(base, safe_ip)
            url = f"{base}/v1/models"
            headers: dict[str, str] = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            if sni is not None:
                headers["host"] = sni
            req = client.build_request("GET", url, headers=headers)
            if sni is not None:
                req.extensions["sni_hostname"] = sni
            resp = await client.send(req)
            resp.raise_for_status()
            data = resp.json()
            return [ModelInfo(id=m["id"], owned_by=m.get("owned_by")) for m in data.get("data", [])]

        elif provider == "anthropic":
            url = "https://api.anthropic.com/v1/models"
            headers = {
                "x-api-key": api_key or "",
                "anthropic-version": "2023-06-01",
            }
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [ModelInfo(id=m["id"], name=m.get("display_name")) for m in data.get("data", [])]

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
            return [ModelInfo(id=m["id"], owned_by=m.get("owned_by")) for m in data.get("data", [])]

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
    Streaming reverse proxy for LLM provider API calls.

    Routes requests to the correct provider base URL, forwarding headers
    and body. This solves CORS restrictions when Studio runs in web mode.

    **Streaming**: When the upstream response has a streaming content-type
    (``text/event-stream`` or chunked transfer), the proxy streams chunks
    to the client as they arrive instead of buffering the full response.
    This preserves SSE semantics for progressive token display.

    Usage from Studio:
      Instead of calling https://api.anthropic.com/v1/messages
      Call http://localhost:25811/api/ai/proxy/anthropic/v1/messages

    For openai-compatible providers, pass the base URL as a query param:
      /api/ai/proxy/openai-compatible/v1/chat/completions?base_url=http://localhost:11434
    """
    # Resolve base URL
    pinned_host: str | None = None
    if provider == "openai-compatible":
        base_url = request.query_params.get("base_url", settings.ollama_default_url)
        # Normalize: strip trailing slashes to avoid double-slash in URL
        base_url = base_url.rstrip("/")
        # SSRF protection: resolve + validate, then pin the vetted IP so the
        # connection cannot be re-resolved to an internal address (rebinding).
        safe_ip = _validate_upstream_url(base_url)
        base_url, pinned_host = _pin_host(base_url, safe_ip)
    else:
        resolved_url = PROVIDER_URLS.get(provider)
        if not resolved_url:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
        base_url = resolved_url

    upstream_url = f"{base_url}/{path}"

    # Forward headers using allowlist to prevent leaking auth tokens (C4)
    forward_headers: dict[str, str] = {}
    for key, value in request.headers.items():
        if key.lower() in _FORWARD_ALLOWLIST:
            forward_headers[key] = value
    # Forward Authorization only if it looks like a provider key (not our session token)
    auth_header = request.headers.get("authorization", "")
    if auth_header and not auth_header.startswith("Bearer sw-"):
        forward_headers["authorization"] = auth_header
    # When the host was pinned to a raw IP, preserve the original hostname for
    # name-based virtual hosting and TLS SNI (set on the request below).
    if pinned_host is not None:
        forward_headers["host"] = pinned_host

    # Read request body
    body = await request.body()

    # Forward query params (minus our internal base_url param)
    forward_params = {k: v for k, v in request.query_params.items() if k != "base_url"} or None

    # Use a long-lived client for the streaming response.
    # We CANNOT use `async with` for the client here because the
    # StreamingResponse sends chunks lazily - the client must stay open
    # past the lifetime of this coroutine.
    client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0),
    )

    try:
        upstream_req = client.build_request(
            method=request.method,
            url=upstream_url,
            headers=forward_headers,
            content=body if body else None,
            params=forward_params,
        )
        if pinned_host is not None:
            # TLS SNI must use the original hostname, not the pinned IP.
            upstream_req.extensions["sni_hostname"] = pinned_host
        upstream_resp = await client.send(upstream_req, stream=True)
    except httpx.ConnectError:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Could not connect to {provider}")
    except httpx.ReadTimeout:
        await client.aclose()
        raise HTTPException(status_code=504, detail="Upstream timeout")
    except Exception as exc:
        await client.aclose()
        logger.error("proxy_error provider=%s error=%s", provider, str(exc))
        raise HTTPException(status_code=502, detail=str(exc))

    # Forward response headers, stripping hop-by-hop
    response_headers: dict[str, str] = {}
    for key, value in upstream_resp.headers.items():
        if key.lower() not in _HOP_BY_HOP and key.lower() != "content-encoding":
            response_headers[key] = value

    # Determine if the response is a stream (SSE or chunked)
    content_type = upstream_resp.headers.get("content-type", "")
    transfer_enc = upstream_resp.headers.get("transfer-encoding", "")
    is_stream = "text/event-stream" in content_type or "chunked" in transfer_enc

    if is_stream:
        # Stream SSE chunks to the client as they arrive
        async def stream_chunks() -> AsyncIterator[bytes]:
            try:
                async for chunk in upstream_resp.aiter_bytes():
                    yield chunk
            finally:
                await upstream_resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_chunks(),
            status_code=upstream_resp.status_code,
            headers=response_headers,
            media_type=content_type,
        )
    else:
        # Non-streaming response - read fully and return
        content = await upstream_resp.aread()
        await upstream_resp.aclose()
        await client.aclose()
        return Response(
            content=content,
            status_code=upstream_resp.status_code,
            headers=response_headers,
        )
