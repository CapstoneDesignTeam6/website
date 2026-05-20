from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class DiscussionSession(Base):
    __tablename__ = "discussion_sessions_local"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    stance = Column(Integer, default=1)          # 1=찬성, -1=반대
    news_data = Column(JSON, default=list)
    agents_config = Column(JSON, default=dict)
    intro_summary = Column(String, nullable=True)
    status = Column(String, default="ongoing")   # ongoing | completed
    score = Column(Float, default=0.0)
    evaluation_detail = Column(JSON, nullable=True)
    exp_earned = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
