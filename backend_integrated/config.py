import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 기본 설정
    APP_NAME: str = "Discussion Agent Backend"
    DEBUG: bool = True
    
    # Supabase 설정
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "your-anon-key")
    
    # 데이터베이스 URL (로컬 SQLite 또는 Supabase PostgreSQL)
    DATABASE_URL: str = "sqlite:///./test.db"  # 로컬 개발용 SQLite
    
    # JWT 설정
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
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

    # OpenAI (AI 서버 미동작 시 폴백)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Naver Search API (트렌딩 토론 주제 생성용)
    NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
    NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
