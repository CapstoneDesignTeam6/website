from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from supabase import Client
from pydantic import BaseModel
from typing import List
import re

from schemas.discussion import (
    DiscussionDetailResponse,
    DiscussionHistoryResponse
)
from services.discussion_service import DiscussionService
from services.auth_service import AuthService
from services.agent_service import AgentService
from database import get_db, get_supabase
import asyncio
import logging

_logger = logging.getLogger(__name__)
_refresh_running = False  # 동시 갱신 방지 플래그


async def _refresh_if_needed():
    """뉴스/주제가 만료됐으면 백그라운드에서 갱신한다.
    Render 상시 실행 환경이므로 타임아웃 없이 Playwright 크롤링도 가능.
    """
    global _refresh_running
    if _refresh_running:
        return
    _refresh_running = True
    try:
        from services.news import is_news_expired, crawl_and_replace_news
        from services.topic import generate_and_save_topics

        if is_news_expired():
            _logger.info("🔄 [bg] 뉴스 만료 → 크롤링 시작...")
            try:
                crawl_result = await crawl_and_replace_news()
                _logger.info(f"🔄 [bg] 크롤링 결과: {crawl_result}")
            except Exception as crawl_err:
                _logger.error(f"❌ [bg] 크롤링 실패 — {type(crawl_err).__name__}: {crawl_err}")

        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(None, lambda: generate_and_save_topics(force=False))
            _logger.info(f"💬 [bg] 주제 갱신 결과: {result}")
        except Exception as topic_err:
            _logger.error(f"❌ [bg] 주제 생성 실패 — {type(topic_err).__name__}: {topic_err}")
    finally:
        _refresh_running = False


# 1대1 토론 라우터 (단수형)
router = APIRouter(prefix="/api/debate", tags=["debates"])

# 공개 API 라우터 (복수형 - 인증 불필요)
public_router = APIRouter(prefix="/api/debates", tags=["discussions"])

# 의존성: 현재 사용자 조회 (토큰 없으면 게스트로 처리)
async def get_current_user(request: Request, supabase: Client = Depends(get_supabase)) -> dict:
    """Authorization 헤더에서 토큰을 읽어 사용자 조회. 토큰 없으면 게스트 반환."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[len('Bearer '):]
        user = AuthService.get_user_from_token(token, supabase)
        if user:
            return user

    # 토큰 없거나 유효하지 않으면 게스트로 처리
    return {"id": 0, "is_guest": True, "level": 1, "experience_points": 0}

class DebateMessageRequest(BaseModel):
    topic: str
    message: str
    history: list = []
    discussion_id: int | None = None
    turn: int = 0
    difficulty: str = "normal"

class DebateAnalyzeRequest(BaseModel):
    topic: str
    messages: list = []
    discussion_id: int | None = None



@router.post("/message")
async def send_message(
    body: DebateMessageRequest,
    user: dict = Depends(get_current_user)
):
    import asyncio
    import queue as _q
    import json as _json
    from datetime import datetime as dt
    from fastapi.responses import StreamingResponse
    from services.debate_orchestrator import start_new_turn, set_event_queue, clear_event_queue

    discussion_id = body.discussion_id or int(dt.now().timestamp() * 1000)
    event_queue: _q.Queue = _q.Queue()
    set_event_queue(discussion_id, event_queue)

    # 새 토론 시작 시 (discussion_id가 없었을 때) → session 저장 + participants 증가
    if not body.discussion_id:
        try:
            from database import get_supabase_client
            _sb = get_supabase_client()

            # 로그인 유저만 session 저장
            if user.get('id') and not user.get('is_guest'):
                _sb.table("discussion_sessions").insert({
                    "id": discussion_id,
                    "user_id": user['id'],
                    "topic": body.topic,
                    "difficulty": body.difficulty,
                }).execute()

            # 게스트 포함 모든 유저 → 해당 주제 participants +1
            _topic_row = (
                _sb.table("discussion_topics")
                .select("id, participants")
                .eq("title", body.topic)
                .limit(1)
                .execute()
                .data
            )
            if _topic_row:
                _new_count = (_topic_row[0].get("participants") or 0) + 1
                _sb.table("discussion_topics").update({"participants": _new_count}).eq("id", _topic_row[0]["id"]).execute()
        except Exception as e:
            _logger.warning(f"[participants] 업데이트 실패: {e}")

    async def generate():
        loop = asyncio.get_running_loop()
        future = loop.run_in_executor(None, lambda: start_new_turn(
            discussion_id=discussion_id,
            now_turn=body.turn,
            raw_user_message=body.message,
            topic_str=body.topic,
            stage_str=body.difficulty,
        ))
        try:
            # 스레드 완료까지 큐 이벤트를 실시간 스트리밍
            while not future.done():
                try:
                    event = event_queue.get_nowait()
                    yield f"data: {_json.dumps(event, ensure_ascii=False)}\n\n"
                except _q.Empty:
                    await asyncio.sleep(0.05)

            # future 완료 후 남은 이벤트 소진
            await asyncio.sleep(0)
            while not event_queue.empty():
                try:
                    event = event_queue.get_nowait()
                    yield f"data: {_json.dumps(event, ensure_ascii=False)}\n\n"
                except _q.Empty:
                    break

            try:
                response_text = await future
            except Exception as e:
                response_text = None
                print(f"❌ [SSE] start_new_turn 오류: {e}")

            used_materials = list(dict.fromkeys(
                re.findall(r'https?://[^\s\]\)\'"]+', response_text or '')
            ))
            result_event = {
                "type": "result",
                "discussion_id": discussion_id,
                "used_materials": used_materials,
                "userSide": "pro",
                "aiResponse": {
                    "discussion_id": discussion_id,
                    "side": "con",
                    "content": response_text or "응답을 생성할 수 없습니다.",
                    "timestamp": dt.now().strftime("%H:%M"),
                },
            }
            yield f"data: {_json.dumps(result_event, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        finally:
            # 클라이언트 연결 해제(GeneratorExit) 포함 모든 경우에 정리
            clear_event_queue(discussion_id)
            if not future.done():
                future.cancel()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",          # 브라우저/프록시 버퍼링 방지
            "X-Accel-Buffering": "no",             # Render/nginx 버퍼링 방지
            "Connection": "keep-alive",
        },
    )


    



@router.get("/{discussion_id}/evaluation")
async def get_evaluation(
    discussion_id: int,
    topic: str = "",
):
    """최신 유저 발언 기준 5개 지표 평가 점수 반환 (UserEvaluationScore 형식)"""
    import asyncio
    from services.scoring_service import get_evaluation as _evaluate

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, lambda: _evaluate(discussion_id=discussion_id, topic=topic)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="평가할 발언이 없습니다.")
    return result


@router.post("/analyze")
async def analyze_debate(
    body: DebateAnalyzeRequest,
):
    """토론 최종 분석 — SummaryAgent 기반 (Supabase discussion_turns 사용)
    프론트: { topic, messages, discussion_id } → DiscussionSummaryResponse
    """
    import asyncio
    from services.summary_service import get_summary as _summarize

    discussion_id = body.discussion_id or 0

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, lambda: _summarize(discussion_id=discussion_id, topic=body.topic)
    )

    # 토론 종료 — 인메모리 파일 스토어 해제
    if body.discussion_id:
        try:
            from services.debate_orchestrator import clear_discussion_store
            clear_discussion_store(body.discussion_id)
        except Exception:
            pass

    return result


@router.get("/quiz")
async def get_quiz(
    topic: str = "",
):
    """퀴즈 반환 - AI 서버에서 생성"""
    data = AgentService.get_quiz(topic=topic)
    return data


@router.get("/quiz/set")
async def get_quiz_set(
    topic: str = "",
    phase: str = "pre",
    discussion_id: int = 0,
):
    """사전(pre)/사후(post) 퀴즈 세트 반환.
    discussion_id 기준으로 Supabase discussion_turns에서 컨텍스트를 구성해 퀴즈 생성.
    """
    from services.quiz_service import get_quiz_set as _get_quiz_set
    import asyncio
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(
        None, lambda: _get_quiz_set(topic=topic, phase=phase, discussion_id=discussion_id)
    )
    return data


@router.get("/stats/summary", response_model=dict)
async def get_discussion_stats(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 통계"""
    stats = DiscussionService.get_discussion_stats(user, db)
    return stats


@router.get("/{discussion_id}", response_model=DiscussionDetailResponse)
async def get_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 상세 조회"""
    discussion = DiscussionService.get_discussion_by_id(discussion_id, db)
    
    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="토론을 찾을 수 없습니다."
        )
    
    if discussion.user_id != user['id']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )
    
    return discussion

@router.get("/", response_model=List[DiscussionHistoryResponse])
async def get_user_discussions(
    skip: int = 0,
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """사용자의 토론 히스토리 (Supabase discussion_sessions 기반)"""
    user_id = user.get('id')
    if not user_id or user.get('is_guest'):
        return []
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_sessions")
            .select("id, topic, difficulty, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(skip, skip + limit - 1)
            .execute()
            .data
        ) or []
        return [
            {
                "id": r["id"],
                "topic": r["topic"],
                "difficulty": r.get("difficulty", "normal"),
                "status": "completed",
                "score": 0.0,
                "exp_earned": 0,
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    except Exception as e:
        _logger.error(f"[discussion_sessions] 히스토리 조회 실패: {e}")
        return []


# ====== 평가 에이전트 관련 엔드포인트 ======

def _get_history_from_supabase(discussion_id: int) -> list[dict]:
    """Supabase discussion_turns에서 history 복원."""
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_turns")
            .select("user_message, ai_summary")
            .eq("discussion_id", discussion_id)
            .order("turn_number", desc=False)
            .execute()
            .data
        ) or []
        history = []
        for r in rows:
            if r.get("user_message"):
                history.append({"role": "user", "content": r["user_message"]})
            if r.get("ai_summary"):
                history.append({"role": "ai", "content": r["ai_summary"]})
        return history
    except Exception:
        return []


@router.post("/{discussion_id}/counter-hint")
async def get_discussion_counter_hint(
    discussion_id: int,
    topic: str = "",
):
    """재반박 힌트 생성 — Supabase discussion_turns 기반."""
    history = _get_history_from_supabase(discussion_id)
    if not history:
        raise HTTPException(status_code=404, detail="토론 기록을 찾을 수 없습니다.")
    return AgentService.get_counter_hint(topic=topic, history=history)


@router.post("/{discussion_id}/rebuttal-hint")
async def get_discussion_rebuttal_hint(
    discussion_id: int,
    topic: str = "",
):
    """반박 힌트 생성 — Supabase discussion_turns 기반."""
    history = _get_history_from_supabase(discussion_id)
    if not history:
        raise HTTPException(status_code=404, detail="토론 기록을 찾을 수 없습니다.")
    return AgentService.get_rebuttal_hint(topic=topic, history=history)


# ====== 트렌딩 및 검색 엔드포인트 (공개 API) ======

# 카테고리 키워드 매핑
_CATEGORY_KEYWORDS = {
    "정치": ["정치", "국회", "대통령", "정부", "선거", "의원", "여당", "야당", "탄핵", "대선"],
    "경제": ["경제", "주식", "금리", "물가", "재정", "투자", "기업", "무역", "수출", "달러", "코스피"],
    "사회": ["사회", "사건", "사고", "범죄", "복지", "교육", "의료", "노동", "인권", "학교"],
    "기술": ["AI", "인공지능", "기술", "반도체", "IT", "디지털", "플랫폼", "데이터", "로봇", "챗GPT"],
    "환경": ["환경", "기후", "탄소", "에너지", "재생", "폭우", "폭염", "미세먼지"],
    "국제": ["미국", "중국", "일본", "러시아", "북한", "국제", "외교", "전쟁", "유럽", "트럼프"],
    "문화": ["문화", "연예", "스포츠", "영화", "음악", "드라마", "축구", "올림픽"],
}

_CATEGORY_COLORS = {
    "정치": "text-red-600",
    "경제": "text-blue-600",
    "사회": "text-emerald-600",
    "기술": "text-purple-600",
    "환경": "text-green-600",
    "국제": "text-orange-600",
    "문화": "text-pink-600",
}


def _detect_category(title: str) -> str:
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in title for kw in keywords):
            return cat
    return "사회"


def _source_from_url(url: str) -> str:
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.replace("www.", "")
        return host.split(".")[0].upper() or "뉴스"
    except Exception:
        return "뉴스"


@public_router.get("/related-materials")
async def get_related_materials(topic: str = "", discussion_id: int = 0):
    """
    토론 관련 뉴스 자료 반환.
    discussion_id가 있으면 해당 토론의 discussion_search_results에서,
    없으면 news 테이블에서 키워드 매칭으로 조회한다.
    """
    from database import get_supabase_client

    sb = get_supabase_client()

    if discussion_id:
        # discussion_search_results에서 해당 토론 검색 결과 조회
        try:
            rows = (
                sb.table("discussion_search_results")
                .select("title, url, content")
                .eq("discussion_id", str(discussion_id))
                .execute()
                .data
            ) or []
        except Exception:
            rows = []

        # url 기준 중복 제거
        seen_urls: set[str] = set()
        result = []
        for item in rows:
            url = item.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            category = _detect_category(item.get("title", ""))
            result.append({
                "category": category,
                "color": _CATEGORY_COLORS.get(category, "text-gray-600"),
                "title": item.get("title", ""),
                "description": (item.get("content") or "")[:120],
                "source": _source_from_url(url),
                "url": url,
            })
        return result

    # fallback: news 테이블 키워드 매칭
    try:
        rows = sb.table("news").select("title, url").order("crawled_at", desc=True).execute().data
    except Exception:
        rows = []

    if not rows:
        return []

    keywords = [w for w in topic.replace("?", "").replace(".", "").split() if len(w) > 1]

    def score(title: str) -> int:
        return sum(1 for kw in keywords if kw in title)

    ranked = sorted(rows, key=lambda r: score(r["title"]), reverse=True)
    result = []
    for item in ranked[:5]:
        category = _detect_category(item["title"])
        result.append({
            "category": category,
            "color": _CATEGORY_COLORS.get(category, "text-gray-600"),
            "title": item["title"],
            "description": "",
            "source": _source_from_url(item.get("url", "")),
            "url": item.get("url", ""),
        })
    return result


@public_router.get("/trending")
async def get_trending_debates(background_tasks: BackgroundTasks):
    """Supabase discussion_topics 테이블 기반 트렌딩 토론 주제 목록.
    기존 DB 데이터를 즉시 반환하고, 만료 여부에 따라 백그라운드에서 갱신한다.
    """
    # 1. 현재 DB 데이터 즉시 조회
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_topics")
            .select("id, title, description, category, participants")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data
        ) or []
    except Exception:
        rows = []

    # 2. 응답 후 백그라운드에서 만료 체크 & 갱신
    background_tasks.add_task(_refresh_if_needed)

    # 3. 즉시 반환
    result = []
    for i, row in enumerate(rows):
        result.append({
            "id": row.get("id", i),
            "category": row.get("category", "시사"),
            "isHot": row.get("participants", 0) < 100,
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "participants": row.get("participants", 0),
        })
    return result


@public_router.get("/search")
async def search_debates(q: str = ""):
    """discussion_topics 테이블에서 키워드 검색"""
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_topics")
            .select("id, title, description, category, side_a, side_b, related_news, participants, created_at")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
        ) or []
    except Exception:
        rows = []

    if q:
        q_lower = q.lower()
        rows = [
            r for r in rows
            if q_lower in (r.get("title") or "").lower()
            or q_lower in (r.get("description") or "").lower()
            or q_lower in (r.get("category") or "").lower()
        ]

    data = [
        {
            "id": row.get("id", 0),
            "category": row.get("category", "시사"),
            "isHot": False,
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "participants": row.get("participants", 0),
            "side_a": row.get("side_a", ""),
            "side_b": row.get("side_b", ""),
            "related_news": row.get("related_news") or [],
        }
        for row in rows[:20]
    ]
    return {"code": 200, "message": "Success", "data": data}
