from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "dev"
    database_url: str = "postgresql+asyncpg://autistic-cow:autistic-cow@localhost:5444/autistic-cow"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_photos: str = "photos"
    s3_bucket_quarantine: str = "photo-quarantine"
    jwt_secret: str = "change-me-in-prod"
    jwt_access_ttl_s: int = 900          # 15 min
    jwt_refresh_ttl_s: int = 60 * 60 * 24 * 30
    tuning_version: str = "0.1.0"
    policy_version: str = "pp-2026-07"
    
    # OAuth lands when the consoles approve — config, not code (Drop 2 decision)
    oauth_google_enabled: bool = False
    oauth_apple_enabled: bool = False

    model_config = {"env_file": (".env", "../.env"), "extra": "ignore"}


@lru_cache
def settings() -> Settings:
    return Settings()
