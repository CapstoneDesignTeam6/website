from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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
from database import get_db
from models.user import User

router = APIRouter(prefix="/discussions", tags=["discussions"])

# 의존성: 현재 사용자 조회
async def get_current_user(token: str = None, db: Session = Depends(get_db)) -> User:
    """현재 사용자 조회"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 필요합니다."
        )
    
    user = AuthService.get_user_from_token(token, db)
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
    user: User = Depends(get_current_user)
):
    """새로운 토론 시작"""
    # 게스트 일일 제한 확인
    if not DiscussionService.check_guest_daily_limit(user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"게스트는 하루에 {3}회까지만 토론할 수 있습니다."
        )
    
    # 토론 생성
    discussion = DiscussionService.create_discussion(user, discussion_data, db)
    
    return discussion

@router.post("/{discussion_id}/add-message")
async def add_message_to_discussion(
    discussion_id: int,
    speaker: str,
    content: str,
    role: str = "agent",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """토론에 메시지 추가"""
    # 토론 조회
    discussion = DiscussionService.get_discussion_by_id(discussion_id, db)
    
    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="토론을 찾을 수 없습니다."
        )
    
    if discussion.user_id != user.id:
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

@router.post("/{discussion_id}/end", response_model=dict)
async def end_discussion(
    discussion_id: int,
    end_request: DiscussionEndRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """토론 종료 및 평가"""
    # 토론 조회
    discussion = DiscussionService.get_discussion_by_id(discussion_id, db)
    
    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="토론을 찾을 수 없습니다."
        )
    
    if discussion.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )
    
    # 토론 종료 및 평가
    result = DiscussionService.end_discussion(discussion, end_request, user, db)
    
    return result

@router.get("/{discussion_id}", response_model=DiscussionDetailResponse)
async def get_discussion(
    discussion_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """토론 상세 조회"""
    discussion = DiscussionService.get_discussion_by_id(discussion_id, db)
    
    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="토론을 찾을 수 없습니다."
        )
    
    if discussion.user_id != user.id:
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
    user: User = Depends(get_current_user)
):
    """사용자의 토론 히스토리"""
    discussions = DiscussionService.get_user_discussions(user, db, skip, limit)
    return discussions

@router.get("/stats/summary", response_model=dict)
async def get_discussion_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """토론 통계"""
    stats = DiscussionService.get_discussion_stats(user, db)
    return stats

@router.post("/{discussion_id}/generate-agent-response")
async def generate_agent_response(
    discussion_id: int,
    agent_index: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """에이전트 응답 생성"""
    # 토론 조회
    discussion = DiscussionService.get_discussion_by_id(discussion_id, db)
    
    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="토론을 찾을 수 없습니다."
        )
    
    if discussion.user_id != user.id:
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
