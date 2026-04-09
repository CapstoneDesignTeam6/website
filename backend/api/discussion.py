from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from supabase import Client
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

# 의존성: 현재 사용자 조회
async def get_current_user(request: Request, supabase: Client = Depends(get_supabase)) -> dict:
    """Authorization 헤더에서 토큰을 읽어 사용자 조회"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 필요합니다."
        )
    token = auth_header[len('Bearer '):]

    user = AuthService.get_user_from_token(token, supabase)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다."
        )

    return user

@router.post("/start", response_model=DiscussionResponse)
async def start_discussion(
    discussion_data: DiscussionCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """새로운 토론 시작 및 배경 요약 생성"""
    # 게스트 일일 제한 확인
    if not DiscussionService.check_guest_daily_limit(user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"게스트는 하루에 {3}회까지만 토론할 수 있습니다."
        )
    
    # 토론 생성
    discussion = DiscussionService.create_discussion(user, discussion_data, db)
    
    # 배경 요약 생성 (평가 에이전트)
    intro_result = AgentService.get_intro(
        topic=discussion.topic,
        stance=discussion.stance,
        news_data=discussion.news_data
    )
    
    # 요약 저장
    discussion.intro_summary = intro_result.get("summary", "")
    db.commit()
    db.refresh(discussion)
    
    return discussion

@router.post("/message")
async def add_message_to_discussion(
    discussion_id: int,
    speaker: str,
    content: str,
    role: str = "agent",
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론에 메시지 추가"""
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
    
    # 메시지 추가
    message = DiscussionService.add_message(discussion, speaker, content, role, db)
    
    return {
        "id": message.id,
        "speaker": message.speaker,
        "content": message.content,
        "role": message.role,
        "created_at": message.created_at
    }

@router.post("/analyze", response_model=dict)
async def end_discussion(
    discussion_id: int,
    end_request: DiscussionEndRequest,
    db: Session = Depends(get_db),
    supabase: Client = Depends(get_supabase),
    user: dict = Depends(get_current_user)
):
    """토론 종료 및 평가 요약"""
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
    
    # 대화 히스토리 수집
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in discussion.messages
    ]
    
    # 평가 에이전트에서 요약 생성
    summary_result = AgentService.get_summary(
        topic=discussion.topic,
        stance=discussion.stance,
        history=history,
        news_data=discussion.news_data,
        turns=end_request.turns
    )
    
    # 평가 결과 저장
    discussion.evaluation_detail = summary_result
    
    # 토론 종료 및 경험치 계산
    result = DiscussionService.end_discussion(discussion, end_request, user, db, supabase)
    
    # 평가 결과 포함
    result["evaluation"] = summary_result
    
    return result

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

@router.get("/stats/summary", response_model=dict)
async def get_discussion_stats(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """토론 통계"""
    stats = DiscussionService.get_discussion_stats(user, db)
    return stats

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


@router.get("/quiz")
async def get_quiz(
    topic: str = "",
    db: Session = Depends(get_db)
):
    """토론 주제 관련 해석 및 실천 팁 제공 (퀴즈 형식)"""
    return {
        "code": 200,
        "message": "Success",
        "data": {
            "topic": topic,
            "quizzes": [
                {
                    "id": 1,
                    "type": "multiple_choice",
                    "question": f"'{topic}'에 대해 어떤 입장이 더 타당할까요?",
                    "options": [
                        {
                            "id": "A",
                            "text": "찬성 입장이 더 타당하다",
                            "explanation": "이 입장의 주요 근거는..."
                        },
                        {
                            "id": "B",
                            "text": "반대 입장이 더 타당하다",
                            "explanation": "이 입장의 주요 근거는..."
                        }
                    ]
                },
                {
                    "id": 2,
                    "type": "practice",
                    "question": "이 주제로 다음에 토론할 때 피해야 할 점은?",
                    "tips": [
                        "논거 없이 감정적으로 반박하기",
                        "상대방의 의견을 왜곡해서 이해하기",
                        "통계나 자료를 검증하지 않고 사용하기"
                    ]
                }
            ]
        }
    }
