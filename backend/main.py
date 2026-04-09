from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_all_tables
from models.level_config import LevelConfig, LEVEL_CONFIG_DATA
from services.level_service import LevelService
from services.agent_service import AgentService
from api import auth, discussion, level
from database import SessionLocal
from config import settings
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 토론 에이전트 백엔드 API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 운영에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(discussion.router)
app.include_router(level.router)

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 초기화"""
    logger.info("Initializing database...")
    create_all_tables()
    
    # 레벨 설정 초기화
    db = SessionLocal()
    try:
        LevelService.initialize_level_configs(db)
        logger.info("Level configurations initialized")
    finally:
        db.close()
    
    # AI 서버 상태 확인
    logger.info("Checking AI servers...")
    health = AgentService.health_check()
    
    if health["discussion_agent"]:
        logger.info(f"✅ 토론 AI 서버 ({settings.DISCUSSION_AGENT_URL}) 정상")
    else:
        logger.warning(f"⚠️ 토론 AI 서버 ({settings.DISCUSSION_AGENT_URL}) 응답 없음")
    
    if health["evaluation_agent"]:
        logger.info(f"✅ 평가 AI 서버 ({settings.EVALUATION_AGENT_URL}) 정상")
    else:
        logger.warning(f"⚠️ 평가 AI 서버 ({settings.EVALUATION_AGENT_URL}) 응답 없음")
    
    if not health["all_healthy"]:
        logger.warning("⚠️ 일부 AI 서버가 응답하지 않습니다. 폴백 응답을 사용합니다.")

@app.on_event("shutdown")
async def shutdown_event():
    """앱 종료 시 정리"""
    logger.info("Shutting down application...")

@app.get("/")
async def root():
    """기본 엔드포인트"""
    return {
        "message": "AI 토론 에이전트 백엔드 API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {
        "status": "healthy",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
