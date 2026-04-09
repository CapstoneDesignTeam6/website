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
    agents_config: Dict[str, Any] = {}

class DiscussionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    topic: str
    status: str
    score: float
    exp_earned: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class DiscussionDetailResponse(DiscussionResponse):
    agents_config: Dict[str, Any]
    evaluation_detail: Optional[Dict[str, Any]]
    messages: List[MessageResponse]
    updated_at: datetime
    completed_at: Optional[datetime]

class DiscussionEndRequest(BaseModel):
    score: float  # 토론 평가 점수 (0-100)
    evaluation_detail: Optional[Dict[str, Any]] = None

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
