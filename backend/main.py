from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from database import create_all_tables
from models.level_config import LevelConfig, LEVEL_CONFIG_DATA
from services.level_service import LevelService
from services.agent_service import AgentService
from api import auth, discussion, level
from api.auth import auth_router
from database import SessionLocal
from config import settings
import logging
import time
import json
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 요청/응답 로깅 미들웨어
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 요청 정보
        request_time = time.time()
        request_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
        
        # 요청 로그 (body 읽기 제거 - BaseHTTPMiddleware deadlock 방지)
        logger.info(f"""
        ╔═══════════════════════════════════════════════════════════════╗
        ║ 📥 API 요청 [{request_id}]
        ║ 🕐 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        ║ 🔗 경로: {request.method} {request.url.path}
        ║ 📋 쿼리: {dict(request.query_params) if request.query_params else 'None'}
        ║ 👤 클라이언트: {request.client.host if request.client else 'Unknown'}
        ║ 🔐 토큰: {request.headers.get('Authorization', 'None')[:30]}...
        ╚═══════════════════════════════════════════════════════════════╝
        """)
        
        # 응답 처리
        response = await call_next(request)
        
        # 응답 시간
        process_time = time.time() - request_time
        
        # 응답 로그
        logger.info(f"""
        ╔═══════════════════════════════════════════════════════════════╗
        ║ 📤 API 응답 [{request_id}]
        ║ ✅ 상태: {response.status_code}
        ║ ⏱️  소요시간: {process_time:.3f}초
        ║ 🔗 경로: {request.method} {request.url.path}
        ║ 📍 Content-Type: {response.headers.get('content-type', 'N/A')}
        ╚═══════════════════════════════════════════════════════════════╝
        """)
        
        return response

# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 토론 에이전트 백엔드 API",
    version="1.0.0"
)

# 로깅 미들웨어 추가 (CORS 이전)
app.add_middleware(LoggingMiddleware)

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
app.include_router(auth_router)
app.include_router(discussion.router)
app.include_router(discussion.public_router)
app.include_router(level.router)

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 초기화"""
    logger.info("Initializing database...")
    create_all_tables()

    # Supabase 연결 테스트
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        sb.table('users').select('id').limit(1).execute()
        logger.info("✅ Supabase 연결 성공")
    except Exception as e:
        logger.error(f"❌ Supabase 연결 실패: {e}")
        logger.error("→ Supabase 대시보드에서 프로젝트가 Active 상태인지 확인하세요.")
    
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
