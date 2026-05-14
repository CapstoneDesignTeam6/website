from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any

class MessageResponse(BaseModel):
    id: int
    speaker: str
    content: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DiscussionCreate(BaseModel):
    title: str
    topic: str
    stance: int = 1  # 1=찬성, -1=반대
    news_data: List[Dict[str, Any]] = []
    agents_config: Dict[str, Any] = {}

class DiscussionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    topic: str
    stance: int
    status: str
    score: float
    exp_earned: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class DiscussionDetailResponse(DiscussionResponse):
    agents_config: Dict[str, Any]
    news_data: List[Dict[str, Any]]
    intro_summary: Optional[str]
    evaluation_detail: Optional[Dict[str, Any]]
    messages: List[MessageResponse]
    updated_at: datetime
    completed_at: Optional[datetime]

class MessageSendRequest(BaseModel):
    """사람이 메시지를 보낼 때"""
    content: str

class MessageResponse_Full(BaseModel):
    """메시지 전송 후 응답"""
    id: int
    speaker: str
    content: str
    role: str
    created_at: datetime
    hint: Optional[str] = None  # 에이전트 힌트 (있으면)
    
    class Config:
        from_attributes = True

class DiscussionEndRequest(BaseModel):
    turns: int = 1  # 진행된 라운드 수
    score: Optional[float] = None  # 토론 점수 (평가 결과 포함 시)
    evaluation_detail: Optional[Dict[str, Any]] = None  # 평가 상세 정보

class DiscussionSummaryResponse(BaseModel):
    """토론 종료 후 평가"""
    summary: str
    issues: str
    logic_feedback: str
    extra_info: str
    score: float
    exp_earned: int
    
    class Config:
        from_attributes = True

class DiscussionHistoryResponse(BaseModel):
    id: int
    title: str
    topic: str
    score: float
    exp_earned: int
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True
