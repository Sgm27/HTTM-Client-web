from fastapi import APIRouter, Depends, Request

from ...services.supabase_proxy import SupabaseProxyService, get_supabase_proxy

router = APIRouter()


@router.api_route(
    "/supabase/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_supabase(
    path: str,
    request: Request,
    proxy_service: SupabaseProxyService = Depends(get_supabase_proxy),
):
    return await proxy_service.proxy(request, path)
