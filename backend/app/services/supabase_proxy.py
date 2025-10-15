from __future__ import annotations

from typing import Dict

import httpx
from fastapi import Depends, HTTPException, Request
from starlette.responses import Response

from ..core.config import Settings, get_settings


class SupabaseProxyService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(base_url=str(settings.supabase_url), timeout=60.0)

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

        headers["apikey"] = self._settings.supabase_service_role_key
        if not any(h.lower() == "authorization" and headers[h] for h in headers):
            headers["Authorization"] = f"Bearer {self._settings.supabase_service_role_key}"

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

        filtered_headers = {
            key: value
            for key, value in upstream_response.headers.items()
            if key.lower() not in {"content-length", "transfer-encoding", "connection"}
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
