from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from config import settings

# Supabase 클라이언트 (싱글턴)
_supabase_client: Client = None

def get_supabase_client() -> Client:
    """Supabase 클라이언트 반환 (서버사이드 설정, timeout 10초)"""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY,
            options=ClientOptions(
                auto_refresh_token=False,   # 서버사이드: 토큰 자동갱신 불필요
                persist_session=False,      # 서버사이드: 세션 저장 불필요
                postgrest_client_timeout=10,
            )
        )
    return _supabase_client

def get_supabase() -> Client:
    """FastAPI Depends용 Supabase 클라이언트"""
    return get_supabase_client()

# 데이터베이스 엔진 생성
# 로컬 개발용: SQLite, 프로덕션: Supabase PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    # SQLAlchemy 2.0 은닉 경고 제거
    future=True,
    # SQLite 설정
    connect_args={"check_same_thread": False},
)

# 세션 생성
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine,
    # PostgreSQL에서 동시성 문제 방지
    expire_on_commit=True
)

# Base 클래스
Base = declarative_base()

def get_db():
    """의존성 주입용 DB 세션"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_all_tables():
    """모든 테이블 생성"""
    Base.metadata.create_all(bind=engine)
