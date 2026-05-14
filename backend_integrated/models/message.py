from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("discussion_sessions.id"), index=True)
    
    speaker = Column(String)                # 발언자 (에이전트 이름 또는 사용자)
    content = Column(Text)                  # 메시지 내용
    role = Column(String)                   # agent / user
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 관계
    session = relationship("DiscussionSession", back_populates="messages")
    
    def __repr__(self):
        return f"<Message(id={self.id}, speaker={self.speaker}, content_len={len(self.content)})>"
