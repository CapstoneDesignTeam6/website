from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# 데이터베이스 엔진 생성
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# 세션 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
