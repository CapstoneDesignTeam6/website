from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Message(Base):
    __tablename__ = "messages_local"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("discussion_sessions_local.id"), nullable=False, index=True)
    speaker = Column(String, nullable=False)
    content = Column(String, nullable=False)
    role = Column(String, nullable=False)        # user | agent
    created_at = Column(DateTime(timezone=True), server_default=func.now())
