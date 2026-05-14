from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from supabase import Client
from pydantic import BaseModel
from typing import List
from datetime import datetime

from schemas.discussion import (
    DiscussionCreate,
    DiscussionResponse,
    DiscussionDetailResponse,
    DiscussionEndRequest,
    DiscussionHistoryResponse
)
from services.discussion_service import DiscussionService
from services.auth_service import AuthService
from services.agent_service import AgentService
from agents.discussion_agent import DiscussionAgent
from database import get_db, get_supabase

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

class DebateStartRequest(BaseModel):
    topic: str

class DebateMessageRequest(BaseModel):
    topic: str
    message: str
    history: list = []
    discussion_id: int = None   # 세션 ID (메시지 저장용)
    round_number: int = 1

class DebateAnalyzeRequest(BaseModel):
    topic: str
    messages: list = []
    discussion_id: int = None   # 세션 ID (결과 저장용)


def _get_supabase():
    from database import get_supabase_client
    return get_supabase_client()


@router.post("/start")
async def start_discussion(
    body: DebateStartRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 시작 - Supabase에 세션 생성 후 id 반환
    프론트: { topic } → { id, agentName, side, content, timestamp }
    """
    import random
    from datetime import datetime as dt

    agents = ["논리적 비판가", "창의적 대안제시자", "균형잡힌 중재자"]
    agent_name = random.choice(agents)

    intro = AgentService.get_intro(topic=body.topic)
    content = intro.get("summary", f'"{body.topic}"에 대한 토론을 시작합니다.')

    # Supabase에 세션 생성
    session_id = None
    try:
        sb = _get_supabase()
        user_id = user.get("id") if not user.get("is_guest") else None
        res = sb.table("discussion_sessions").insert({
            "user_id": user_id,
            "topic": body.topic,
            "agent_name": agent_name,
            "status": "ongoing",
        }).execute()
        session_id = res.data[0]["id"] if res.data else None
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"세션 생성 실패: {e}")

    return {
        "id": session_id,
        "agentName": agent_name,
        "side": "con",
        "content": content,
        "timestamp": dt.now().strftime("%H:%M"),
    }


@router.post("/message")
async def send_message(
    body: DebateMessageRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """메시지 전송 - 사용자/AI 메시지를 Supabase에 저장
    프론트: { topic, message, history, discussion_id, round_number } → { userSide, aiResponse }
    """
    import random
    import logging
    from datetime import datetime as dt

    logger = logging.getLogger(__name__)
    agents = ["논리적 비판가", "창의적 대안제시자", "균형잡힌 중재자"]
    agent_name = random.choice(agents)

    # "agent" → "assistant" 변환 (GPT 형식)
    history = [
        {
            "role": "assistant" if m.get("role") == "agent" else "user",
            "content": m.get("content", "")
        }
        for m in body.history
        if m.get("content", "").strip()
    ]

    ai_result = AgentService.generate_response(
        agent_name=agent_name,
        agent_role="토론 에이전트",
        topic=body.topic,
        conversation_history=history,
    )
    ai_content = ai_result.get("response", "응답을 생성할 수 없습니다.")
    timestamp = dt.now().strftime("%H:%M")

    # Supabase에 메시지 저장
    if body.discussion_id:
        try:
            sb = _get_supabase()
            sb.table("discussion_messages").insert([
                {
                    "session_id": body.discussion_id,
                    "role": "user",
                    "agent_name": None,
                    "side": "pro",
                    "content": body.message,
                    "round_number": body.round_number,
                },
                {
                    "session_id": body.discussion_id,
                    "role": "agent",
                    "agent_name": agent_name,
                    "side": "con",
                    "content": ai_content,
                    "round_number": body.round_number,
                },
            ]).execute()
        except Exception as e:
            logger.error(f"메시지 저장 실패: {e}")

    return {
        "userSide": "pro",
        "aiResponse": {
            "agentName": agent_name,
            "side": "con",
            "content": ai_content,
            "timestamp": timestamp,
        }
    }


@router.post("/analyze")
async def analyze_debate(
    body: DebateAnalyzeRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 분석 - 결과를 Supabase 세션에 저장
    프론트: { topic, messages, discussion_id } → { result }
    """
    history = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in body.messages]

    summary = AgentService.get_summary(
        topic=body.topic,
        history=history,
        turns=len(body.messages),
    )

    result_text = "\n\n".join([
        f"[토론 요약]\n{summary.get('summary', '')}",
        f"[주요 쟁점]\n{summary.get('issues', '')}",
        f"[논리 피드백]\n{summary.get('logic_feedback', '')}",
        f"[추가 정보]\n{summary.get('extra_info', '')}",
    ])

    # Supabase 세션에 결과 저장 및 완료 처리
    if body.discussion_id:
        try:
            from datetime import datetime as dt
            sb = _get_supabase()
            sb.table("discussion_sessions").update({
                "status": "completed",
                "result_text": result_text,
                "completed_at": dt.utcnow().isoformat(),
            }).eq("id", body.discussion_id).execute()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"세션 완료 저장 실패: {e}")

    return {"result": result_text}


@router.get("/quiz")
async def get_quiz(
    topic: str = "",
    db: Session = Depends(get_db)
):
    """퀴즈 반환 - AI 서버에서 생성"""
    data = AgentService.get_quiz(topic=topic)
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
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """사용자의 토론 히스토리"""
    discussions = DiscussionService.get_user_discussions(user, db, skip, limit)
    return discussions

@router.post("/{discussion_id}/generate-agent-response")
async def generate_agent_response(
    discussion_id: int,
    agent_index: int = 0,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """에이전트 응답 생성"""
    # 토론 조회
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
    
    # 기본 에이전트 생성
    agents = DiscussionAgent.create_default_agents()
    
    if agent_index >= len(agents):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 에이전트 인덱스입니다."
        )
    
    # 기존 대화 히스토리 조회
    conversation_history = [
        (msg.speaker, msg.content) for msg in discussion.messages
    ]
    
    # 응답 생성
    agent = agents[agent_index]
    response_data = agent.generate_response(discussion.topic, conversation_history)
    
    # 응답 저장
    response_text = response_data["response"]
    DiscussionService.add_message(discussion, agent.name, response_text, "agent", db)
    
    return {
        "agent_name": agent.name,
        "agent_role": agent.role,
        "response": response_text,
        "is_fallback": response_data.get("is_fallback", False),
        "timestamp": response_data.get("timestamp"),
        "note": response_data.get("note", "")
    }

# ====== 평가 에이전트 관련 엔드포인트 ======

@router.post("/{discussion_id}/counter-hint")
async def get_discussion_counter_hint(
    discussion_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """재반박 힌트 생성 (AI가 반박한 직후 호출)
    
    Response:
        {"hint": "재반박 힌트 텍스트"}
    """
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
    
    # 대화 히스토리 수집
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in discussion.messages
    ]
    
    # 재반박 힌트 요청
    hint_result = AgentService.get_counter_hint(
        topic=discussion.topic,
        history=history,
        news_data=discussion.news_data
    )
    
    return hint_result

@router.post("/{discussion_id}/rebuttal-hint")
async def get_discussion_rebuttal_hint(
    discussion_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """반박 힌트 생성 (AI가 새 주장한 직후 호출)
    
    Response:
        {"hint": "반박 힌트 텍스트"}
    """
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
    
    # 대화 히스토리 수집
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in discussion.messages
    ]
    
    # 반박 힌트 요청
    hint_result = AgentService.get_rebuttal_hint(
        topic=discussion.topic,
        history=history,
        news_data=discussion.news_data
    )
    
    return hint_result


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
async def get_related_materials(topic: str = ""):
    """
    토론 주제와 관련된 뉴스 자료 반환.
    Supabase news 테이블에서 키워드 매칭으로 관련 뉴스를 추출한다.
    """
    from database import get_supabase_client

    try:
        sb = get_supabase_client()
        rows = sb.table("news").select("title, url").order("crawled_at", desc=True).execute().data
    except Exception:
        rows = []

    if not rows:
        return []

    # 주제 키워드와 매칭 점수 계산
    keywords = [w for w in topic.replace("?", "").replace(".", "").split() if len(w) > 1]

    def score(title: str) -> int:
        return sum(1 for kw in keywords if kw in title)

    ranked = sorted(rows, key=lambda r: score(r["title"]), reverse=True)
    top = ranked[:5]  # 상위 5개

    result = []
    for item in top:
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
async def get_trending_debates():
    """Supabase discussion_topics 테이블 기반 트렌딩 토론 주제 목록"""
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_topics")
            .select("id, title, description, category, created_at")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data
        ) or []
    except Exception:
        rows = []

    result = []
    for i, row in enumerate(rows):
        result.append({
            "id": row.get("id", i),
            "category": row.get("category", "시사"),
            "isHot": i < 3,  # 최신 3개를 Hot으로 표시
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "participants": 0,
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
            .select("id, title, description, category, created_at")
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
            "topic": row.get("title", ""),
            "stance": "",
            "author": "anonymous",
            "viewCount": 0,
            "messageCount": 0,
            "createdAt": row.get("created_at", ""),
            "updatedAt": row.get("created_at", ""),
        }
        for row in rows[:20]
    ]
    return {"code": 200, "message": "Success", "data": data}
