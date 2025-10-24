from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import health, ml, supabase_proxy
from .core.config import get_settings
from .services.supabase_proxy import shutdown_supabase_proxy


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.backend_app_name)

    if settings.backend_cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.backend_cors_origins],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    api_prefix = settings.backend_api_prefix.rstrip("/")

    app.include_router(health.router, prefix=api_prefix)
    app.include_router(ml.router, prefix=api_prefix)
    app.include_router(supabase_proxy.router, prefix=api_prefix)

    startup_callbacks = []

    if settings.ocr_service_enabled:
        from .services.ocr import on_startup as ocr_startup

        startup_callbacks.append(ocr_startup)

    if settings.tts_service_enabled:
        from .services.tts import on_startup as tts_startup

        startup_callbacks.append(tts_startup)

    if startup_callbacks:

        @app.on_event("startup")
        async def startup_event() -> None:  # pragma: no cover - heavy dependencies
            for callback in startup_callbacks:
                callback()

    @app.on_event("shutdown")
    async def shutdown_event() -> None:  # pragma: no cover
        await shutdown_supabase_proxy()

    return app


app = create_app()
