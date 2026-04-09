import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 기본 설정
    APP_NAME: str = "Discussion Agent Backend"
    DEBUG: bool = True
    
    # 데이터베이스
    DATABASE_URL: str = "sqlite:///./discussion_agent.db"
    
    # JWT 설정
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 네이버 API
    NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
    NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")
    
    # 에이전트 설정
    MODEL_NAME: str = "microsoft/phi-2"
    MAX_NEW_TOKENS: int = 150
    TEMPERATURE: float = 0.7
    
    # 게스트 토론 제한 (일일)
    GUEST_DAILY_LIMIT: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
