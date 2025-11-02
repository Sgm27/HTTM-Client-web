import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

try:  # pragma: no cover - prefer modern pydantic if available
    from pydantic import AnyHttpUrl, Field, field_validator
    from pydantic_settings import BaseSettings
except Exception:  # pragma: no cover
    AnyHttpUrl = str  # type: ignore
    Field = None  # type: ignore
    field_validator = None  # type: ignore
    BaseSettings = None  # type: ignore


def _load_env_file() -> None:
    """Load .env file manually for dataclass fallback"""
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()
                    # Only set if not already in environment
                    if key and key not in os.environ:
                        os.environ[key] = value


def _split_cors(value: str | List[str] | None) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    # Convert to lowercase and remove quotes for comparison
    normalized = value.strip().strip('"').strip("'").lower()
    return normalized not in {"false", "0", "no", "off", ""}


if BaseSettings is not None and Field is not None and field_validator is not None:

    class Settings(BaseSettings):  # type: ignore[misc]
        backend_api_prefix: str = Field("/api", env="API_PREFIX")
        backend_app_name: str = Field("HTTM Backend", env="APP_NAME")
        backend_cors_origins: List[str] = Field(default_factory=list, env="CORS_ORIGINS")

        ocr_service_enabled: bool = Field(True, env="OCR_SERVICE")
        tts_service_enabled: bool = Field(True, env="TTS_SERVICE")

        supabase_url: AnyHttpUrl = Field("http://localhost:54321", env="SUPABASE_URL")
        supabase_service_role_key: str = Field("local-service-role", env="SUPABASE_SERVICE_ROLE_KEY")
        supabase_anon_key: Optional[str] = Field(None, env="SUPABASE_ANON_KEY")

        class Config:
            env_file = ".env"
            env_file_encoding = "utf-8"
            extra = "ignore"  

        @field_validator("backend_cors_origins", mode="before")
        def _split(cls, value: str | List[str] | None) -> List[str]:
            return _split_cors(value)

else:

    @dataclass
    class Settings:  # type: ignore[override]
        backend_api_prefix: str = field(default_factory=lambda: os.getenv("API_PREFIX", "/api"))
        backend_app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "HTTM Backend"))
        backend_cors_origins: List[str] = field(default_factory=lambda: _split_cors(os.getenv("CORS_ORIGINS")))

        ocr_service_enabled: bool = field(default_factory=lambda: _env_bool("OCR_SERVICE", True))
        tts_service_enabled: bool = field(default_factory=lambda: _env_bool("TTS_SERVICE", True))

        supabase_url: AnyHttpUrl = field(default_factory=lambda: os.getenv("SUPABASE_URL", "http://localhost:54321"))
        supabase_service_role_key: str = field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY", "local-service-role"))
        supabase_anon_key: Optional[str] = field(default_factory=lambda: os.getenv("SUPABASE_ANON_KEY"))


# Load .env file for dataclass fallback
if BaseSettings is None:
    _load_env_file()


@lru_cache()
def get_settings() -> Settings:
    return Settings()
