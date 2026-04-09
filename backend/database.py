from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# 데이터베이스 엔진 생성
# PostgreSQL(Supabase)과 SQLite 모두 지원
engine = create_engine(
    settings.DATABASE_URL,
    # SQLAlchemy 2.0 은닉 경고 제거
    future=True,
    # PostgreSQL pool 설정 (SQLite에선 무시됨)
    pool_pre_ping=True,
    pool_recycle=3600,
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
