import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 기본 설정
    APP_NAME: str = "Discussion Agent Backend"
    DEBUG: bool = True
    
    # 데이터베이스
    # Supabase 형식: postgresql://user:password@host:port/database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres.user@host:5432/postgres"  # Supabase 기본값
    )
    
    # JWT 설정
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 네이버 API
    NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
    NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")
    
    # 에이전트 서버 (외부 에이전트 담당자가 운영)
    # 1. 토론 진행용 AI 서버
    DISCUSSION_AGENT_URL: str = os.getenv("DISCUSSION_AGENT_URL", "http://localhost:8001")
    # 2. 토론 평가용 AI 서버
    EVALUATION_AGENT_URL: str = os.getenv("EVALUATION_AGENT_URL", "http://localhost:8002")
    AGENT_TIMEOUT: int = 30  # 에이전트 응답 타임아웃 (초)
    
    # 에이전트 설정 (기본값)
    MAX_NEW_TOKENS: int = 150
    TEMPERATURE: float = 0.7
    
    # 게스트 토론 제한 (일일)
    GUEST_DAILY_LIMIT: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
