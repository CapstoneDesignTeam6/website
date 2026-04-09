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

class DebateAnalyzeRequest(BaseModel):
    topic: str
    messages: list = []


@router.post("/start")
async def start_discussion(
    body: DebateStartRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 시작 - 프론트: { topic } → { agentName, side, content, timestamp }"""
    import random
    from datetime import datetime as dt

    agents = ["논리적 비판가", "창의적 대안제시자", "균형잡힌 중재자"]
    agent_name = random.choice(agents)

    intro = AgentService.get_intro(topic=body.topic, stance=1)

    return {
        "agentName": agent_name,
        "side": "con",
        "content": intro.get("summary", f'"{body.topic}"에 대한 토론을 시작합니다.'),
        "timestamp": dt.now().strftime("%H:%M"),
    }


@router.post("/message")
async def send_message(
    body: DebateMessageRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """메시지 전송 - 프론트: { topic, message, history } → { userSide, aiResponse }"""
    import random
    from datetime import datetime as dt

    agents = ["논리적 비판가", "창의적 대안제시자", "균형잡힌 중재자"]
    agent_name = random.choice(agents)

    # "agent" → "assistant" 로 변환 (GPT 형식)
    history = [
        {
            "role": "assistant" if m.get("role") == "agent" else "user",
            "content": m.get("content", "")
        }
        for m in body.history
        if m.get("content", "").strip()  # 빈 메시지 제외
    ]

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"📜 GPT에 전달되는 history ({len(history)}개):")
    for i, h in enumerate(history):
        logger.info(f"  [{i+1}] {h['role']}: {h['content'][:80]}...")

    ai_result = AgentService.generate_response(
        agent_name=agent_name,
        agent_role="토론 에이전트",
        topic=body.topic,
        conversation_history=history,
    )

    return {
        "userSide": "pro",
        "aiResponse": {
            "agentName": agent_name,
            "side": "con",
            "content": ai_result.get("response", "응답을 생성할 수 없습니다."),
            "timestamp": dt.now().strftime("%H:%M"),
        }
    }


@router.post("/analyze")
async def analyze_debate(
    body: DebateAnalyzeRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 분석 - 프론트: { topic, messages } → { result }"""
    history = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in body.messages]

    summary = AgentService.get_summary(
        topic=body.topic,
        stance=1,
        history=history,
        turns=len(body.messages),
    )

    result_text = "\n\n".join([
        f"[토론 요약]\n{summary.get('summary', '')}",
        f"[주요 쟁점]\n{summary.get('issues', '')}",
        f"[논리 피드백]\n{summary.get('logic_feedback', '')}",
        f"[추가 정보]\n{summary.get('extra_info', '')}",
    ])

    return {"result": result_text}


@router.get("/quiz")
async def get_quiz(
    topic: str = "",
    db: Session = Depends(get_db)
):
    """퀴즈 반환 - 프론트 Quiz 타입과 일치: { id, topic, question, options, correctOptionId, explanation }"""
    import random
    options = [
        {"id": 1, "text": "찬성 입장이 더 타당하다"},
        {"id": 2, "text": "반대 입장이 더 타당하다"},
    ]
    correct_id = random.choice([1, 2])
    return {
        "id": 1,
        "topic": topic,
        "question": f"'{topic}'에 대해 어떤 입장이 더 타당할까요?",
        "options": options,
        "correctOptionId": correct_id,
        "explanation": f"'{topic}' 주제는 양측 모두 타당한 근거가 있습니다. 다양한 관점에서 생각해보는 것이 중요합니다.",
    }


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

@router.post("/{discussion_id}/intro")
async def get_discussion_intro(
    discussion_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 배경 요약 (토론 시작 시 자동 호출, 필요시 재요청 가능)
    
    Response:
        {"summary": "주제 요약 텍스트"}
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
    
    # 배경 요약 생성 또는 기존 값 반환
    if not discussion.intro_summary:
        intro_result = AgentService.get_intro(
            topic=discussion.topic,
            stance=discussion.stance,
            news_data=discussion.news_data
        )
        discussion.intro_summary = intro_result.get("summary", "")
        db.commit()
    
    return {
        "summary": discussion.intro_summary,
        "topic": discussion.topic,
        "stance": discussion.stance
    }

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
        stance=discussion.stance,
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
        stance=discussion.stance,
        history=history,
        news_data=discussion.news_data
    )
    
    return hint_result


# ====== 트렌딩 및 검색 엔드포인트 (공개 API) ======

@public_router.get("/trending")
async def get_trending_debates(
    db: Session = Depends(get_db)
):
    """트렌딩 토론 목록 (최근, 인기도 높은 순서)"""
    try:
        # Mock 데이터: 최근 토론들을 트렌딩으로 반환
        from sqlalchemy import desc
        from models.discussion import DiscussionSession as Discussion
        
        trending = db.query(Discussion)\
            .order_by(desc(Discussion.created_at))\
            .limit(10)\
            .all()
        
        if not trending:
            return {
                "code": 200,
                "message": "Success",
                "data": [
                    {
                        "id": 1,
                        "topic": "인공지능은 인간의 일자리를 빼앗을 것인가?",
                        "stance": "찬성",
                        "author": "debate_user_1",
                        "viewCount": 245,
                        "messageCount": 18,
                        "createdAt": "2026-04-09T10:30:00",
                        "updatedAt": "2026-04-09T11:45:00"
                    },
                    {
                        "id": 2,
                        "topic": "기본소득제는 경제에 도움이 될 것인가?",
                        "stance": "반대",
                        "author": "debate_user_2",
                        "viewCount": 198,
                        "messageCount": 15,
                        "createdAt": "2026-04-08T14:20:00",
                        "updatedAt": "2026-04-08T16:10:00"
                    },
                    {
                        "id": 3,
                        "topic": "재택근무는 생산성을 높일 것인가?",
                        "stance": "찬성",
                        "author": "debate_user_3",
                        "viewCount": 156,
                        "messageCount": 12,
                        "createdAt": "2026-04-07T09:15:00",
                        "updatedAt": "2026-04-07T11:30:00"
                    }
                ]
            }
        
        # DB에 데이터가 있으면 반환
        return {
            "code": 200,
            "message": "Success",
            "data": [
                {
                    "id": d.id,
                    "topic": d.topic,
                    "stance": d.stance,
                    "author": "anonymous",
                    "viewCount": len(d.messages),
                    "messageCount": len(d.messages),
                    "createdAt": d.created_at.isoformat() if d.created_at else "",
                    "updatedAt": d.updated_at.isoformat() if d.updated_at else ""
                }
                for d in trending
            ]
        }
    except Exception as e:
        return {
            "code": 200,
            "message": "Success",
            "data": []
        }


@public_router.get("/search")
async def search_debates(
    q: str = "",
    db: Session = Depends(get_db)
):
    """토론 검색 (키워드로 검색)"""
    try:
        from sqlalchemy import desc
        from models.discussion import DiscussionSession as Discussion
        
        if q:
            # 검색어가 있으면 토픽에서 검색
            results = db.query(Discussion)\
                .filter(Discussion.topic.ilike(f"%{q}%"))\
                .order_by(desc(Discussion.created_at))\
                .limit(20)\
                .all()
        else:
            # 검색어가 없으면 모든 토론 반환
            results = db.query(Discussion)\
                .order_by(desc(Discussion.created_at))\
                .limit(20)\
                .all()
        
        if not results:
            return {
                "code": 200,
                "message": "Success",
                "data": []
            }
        
        return {
            "code": 200,
            "message": "Success",
            "data": [
                {
                    "id": d.id,
                    "topic": d.topic,
                    "stance": d.stance,
                    "author": "anonymous",
                    "viewCount": len(d.messages),
                    "messageCount": len(d.messages),
                    "createdAt": d.created_at.isoformat() if d.created_at else "",
                    "updatedAt": d.updated_at.isoformat() if d.updated_at else ""
                }
                for d in results
            ]
        }
    except Exception as e:
        return {
            "code": 200,
            "message": "Success",
            "data": []
        }
