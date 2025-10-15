from functools import lru_cache
from typing import List, Optional

from pydantic import AnyHttpUrl, BaseSettings, Field, validator


class Settings(BaseSettings):
    backend_api_prefix: str = Field("/api", env="API_PREFIX")
    backend_app_name: str = Field("HTTM Backend", env="APP_NAME")
    backend_cors_origins: List[str] = Field(default_factory=list, env="CORS_ORIGINS")

    supabase_url: AnyHttpUrl = Field(..., env="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., env="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: Optional[str] = Field(None, env="SUPABASE_ANON_KEY")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("backend_cors_origins", pre=True)
    def split_cors_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache()
def get_settings() -> Settings:
    return Settings()
