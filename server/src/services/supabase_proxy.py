from __future__ import annotations

from typing import Dict

import httpx
from fastapi import Depends, HTTPException, Request
from starlette.responses import Response

from ..utils.config import Settings, get_settings


class SupabaseProxyService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # Disable automatic decompression to handle content-encoding properly
        self._client = httpx.AsyncClient(
            base_url=str(settings.supabase_url), 
            timeout=60.0,
            # Let httpx handle decompression automatically
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def proxy(self, request: Request, sub_path: str) -> Response:
        target_url = f"/{sub_path}" if sub_path else "/"
        body = await request.body()

        headers: Dict[str, str] = {}
        for key, value in request.headers.items():
            lowered = key.lower()
            if lowered in {"host", "content-length"}:
                continue
            headers[key] = value

        # Always set apikey header with anon key
        # This is required by Supabase for all requests
        anon_key = self._settings.supabase_anon_key or self._settings.supabase_service_role_key
        headers["apikey"] = anon_key
        
        # Only set Authorization if client didn't provide one
        # If client provides Authorization header, it contains the user's JWT token
        if not any(h.lower() == "authorization" for h in headers):
            headers["Authorization"] = f"Bearer {anon_key}"

        try:
            upstream_response = await self._client.request(
                method=request.method,
                url=target_url,
                params=request.query_params,
                content=body,
                headers=headers,
                cookies=request.cookies,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - network errors
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        # Filter out headers that should not be forwarded
        # Important: Remove content-encoding since httpx already decompressed the content
        filtered_headers = {
            key: value
            for key, value in upstream_response.headers.items()
            if key.lower() not in {
                "content-length", 
                "transfer-encoding", 
                "connection",
                "content-encoding",  # Remove encoding header since content is decompressed
            }
        }

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=filtered_headers,
            media_type=upstream_response.headers.get("content-type"),
        )


_supabase_service: SupabaseProxyService | None = None


async def get_supabase_proxy(settings: Settings = Depends(get_settings)) -> SupabaseProxyService:
    global _supabase_service
    if _supabase_service is None:
        _supabase_service = SupabaseProxyService(settings)
    return _supabase_service


async def shutdown_supabase_proxy() -> None:
    global _supabase_service
    if _supabase_service is not None:
        await _supabase_service.close()
        _supabase_service = None
