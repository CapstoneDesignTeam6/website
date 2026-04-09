from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class DiscussionSession(Base):
    __tablename__ = "discussion_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    title = Column(String)
    topic = Column(String)                                              # 토론 주제
    agents_config = Column(JSON, default={})                            # 에이전트 설정
    status = Column(String, default="ongoing")                          # ongoing / completed
    
    # 평가 및 경험치
    score = Column(Float, default=0.0)                                  # 평가 점수 (0-100)
    exp_earned = Column(Integer, default=0)                             # 획득 경험치
    evaluation_detail = Column(JSON, nullable=True)                     # 평가 상세 정보
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # 관계
    user = relationship("User", back_populates="discussions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<DiscussionSession(id={self.id}, user_id={self.user_id}, topic={self.topic}, score={self.score})>"
