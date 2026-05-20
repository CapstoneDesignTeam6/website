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
import asyncio
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

# 동시 갱신 방지 락
_refresh_lock = asyncio.Lock()


async def _maybe_refresh_data():
    """
    뉴스/주제가 오래됐으면 백그라운드에서 갱신한다.
    - 뉴스: 마지막 크롤링이 하루 이상 지난 경우
    - 주제: 마지막 생성이 7일 이상 지난 경우
    락을 사용해 동시 실행을 방지한다.
    """
    if _refresh_lock.locked():
        return

    async with _refresh_lock:
        try:
            from services.news import is_news_expired, crawl_and_replace_news
            from services.topic import generate_and_save_topics

            if is_news_expired():
                logger.info("🔄 [자동] 뉴스 만료 → 크롤링 시작...")
                crawl_result = await crawl_and_replace_news()
                logger.info(f"🔄 [자동] 크롤링 결과: {crawl_result}")

            loop = asyncio.get_event_loop()
            topic_result = await loop.run_in_executor(
                None, lambda: generate_and_save_topics(force=False)
            )
            logger.info(f"💬 [자동] 주제 확인 결과: {topic_result}")
        except Exception as e:
            logger.error(f"자동 갱신 실패: {e}")


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

# 요청 기반 자동 갱신 미들웨어
class RefreshMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        skip_prefixes = ("/admin", "/docs", "/openapi.json", "/redoc")
        skip_paths = {"/", "/health"}
        path = request.url.path
        if path not in skip_paths and not any(path.startswith(p) for p in skip_prefixes):
            asyncio.create_task(_maybe_refresh_data())
        return await call_next(request)

app.add_middleware(RefreshMiddleware)

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
    
    logger.info("✅ 요청 기반 자동 갱신 활성화 (뉴스: 1일, 주제: 7일)")

    # LLM 설정 상태 확인
    logger.info("Checking LLM configuration...")
    health = AgentService.health_check()

    if health["openai"]:
        logger.info("✅ OpenAI API 키 설정됨")
    else:
        logger.warning("⚠️ OpenAI API 키 미설정 — 토론 응답 생성 불가")

    if health["vertex"]:
        logger.info("✅ Vertex AI 활성화 (DebateOrchestrator 우선 사용)")
    else:
        logger.info("ℹ️ Vertex AI 미설정 — GPT 폴백만 사용")

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

@app.post("/admin/news/crawl")
async def trigger_news_crawl():
    """뉴스 크롤링 수동 실행 (관리자용)"""
    from services.news import crawl_and_replace_news
    logger.info("🗞️ [수동] 뉴스 크롤링 시작...")
    result = await crawl_and_replace_news()
    return result

@app.post("/admin/topics/generate")
async def trigger_topic_generate(force: bool = False):
    """
    토론 주제 생성 수동 실행 (관리자용)
    - force=true: 7일 미경과여도 강제 재생성
    - force=false (기본): 7일 지난 경우에만 생성
    """
    from services.topic import generate_and_save_topics
    import asyncio
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: generate_and_save_topics(force=force))
    return result

@app.post("/admin/news/crawl-and-generate")
async def trigger_crawl_and_generate(force_topics: bool = False):
    """
    뉴스 크롤링 + 토론 주제 생성 한 번에 실행 (관리자용)
    - force_topics=true: 주제 7일 미경과여도 강제 재생성
    """
    from services.news import crawl_and_replace_news
    from services.topic import generate_and_save_topics
    import asyncio

    logger.info("🗞️ [수동] 뉴스 크롤링 + 주제 생성 시작...")
    crawl_result = await crawl_and_replace_news()
    if not crawl_result.get("success"):
        return {"crawl": crawl_result, "topics": {"success": False, "message": "크롤링 실패로 주제 생성 건너뜀"}}

    loop = asyncio.get_event_loop()
    topic_result = await loop.run_in_executor(None, lambda: generate_and_save_topics(force=force_topics))
    return {"crawl": crawl_result, "topics": topic_result}

@app.get("/news")
async def get_news(limit: int = 50):
    """저장된 뉴스 목록 조회"""
    from services.news import get_news_list
    return get_news_list(limit=limit)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
